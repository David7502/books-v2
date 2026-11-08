import { spawn } from "node:child_process";
import { once } from "node:events";

const persist = ".wrangler/add-read-test";
const port = 8794;
const base = `http://127.0.0.1:${port}`;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, CI: "1" },
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk;
    });
    child.stderr.on("data", (chunk) => {
      output += chunk;
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(output || `${command} exited ${code}`));
      }
    });
  });
}

function startServer() {
  return spawn(
    "npx",
    [
      "wrangler",
      "dev",
      "--local",
      "--port",
      String(port),
      "--ip",
      "127.0.0.1",
      "--inspector-port",
      "9244",
      "--persist-to",
      persist,
      "--show-interactive-dev-session",
      "false",
    ],
    { detached: true, stdio: ["ignore", "pipe", "pipe"], env: process.env },
  );
}

async function stopServer(child) {
  if (!child || (child.exitCode !== undefined && child.exitCode !== null)) {
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
  const exited = await Promise.race([
    once(child, "exit").then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 2000)),
  ]);
  if (!exited) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      child.kill("SIGKILL");
    }
  }
}

async function waitForServer(child) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== undefined && child.exitCode !== null) {
      throw new Error(`Le serveur s'est arrêté (${child.exitCode}).`);
    }
    try {
      const response = await fetch(`${base}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Le serveur local n'a pas démarré.");
}

async function jsonRequest(path, init) {
  const response = await fetch(`${base}${path}`, init);
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

await run("npm", ["run", "build"]);
await run("npx", [
  "wrangler",
  "d1",
  "migrations",
  "apply",
  "books-v2",
  "--local",
  "--persist-to",
  persist,
]);

let server = startServer();
try {
  await waitForServer(server);
  const rejected = await jsonRequest("/api/books", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "   ", author: "Lina", ownership: "none", read: true }),
  });
  const badFlag = await jsonRequest("/api/books", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Mauvais", author: "Lina", ownership: "none", read: "oui" }),
  });
  const empty = await jsonRequest("/api/books");
  if (rejected.status !== 400 || badFlag.status !== 400 || empty.body.books.length !== 0) {
    throw new Error("une saisie refusée a laissé un livre");
  }

  const readOnly = await jsonRequest("/api/books", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Livre emprunté",
      author: "Nina",
      ownership: "none",
      read: true,
    }),
  });
  if (readOnly.status !== 201 || readOnly.body.ownership !== "none" || readOnly.body.completed !== true) {
    throw new Error(`création lue sans possession: ${readOnly.status} ${JSON.stringify(readOnly.body)}`);
  }
  const sheet = await jsonRequest(`/api/books/${readOnly.body.id}/reading`);
  if (
    sheet.body.ambiguous !== false ||
    sheet.body.reading?.status !== "read" ||
    sheet.body.reading.startedOn !== null ||
    sheet.body.reading.finishedOn !== null ||
    sheet.body.reading.location !== null ||
    sheet.body.reading.rating !== null
  ) {
    throw new Error(`fiche inventée: ${JSON.stringify(sheet.body)}`);
  }

  const owned = await jsonRequest("/api/books", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Livre possédé",
      author: "Ada",
      ownership: "owned",
      read: false,
    }),
  });
  const wished = await jsonRequest("/api/books", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Livre voulu et lu",
      author: "Milo",
      ownership: "wishlist",
      read: true,
    }),
  });
  if (owned.body.completed !== false || wished.body.completed !== true || wished.body.ownership !== "wishlist") {
    throw new Error("les catégories ne sont pas indépendantes");
  }

  const kept = await jsonRequest(`/api/books/${readOnly.body.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Livre emprunté",
      author: "Nina",
      ownership: "none",
      read: false,
    }),
  });
  const still = await jsonRequest(`/api/books/${readOnly.body.id}/reading`);
  if (kept.body.completed !== true || still.body.reading.id !== sheet.body.reading.id) {
    throw new Error("modifier le livre a changé la fiche");
  }

  const list = await jsonRequest("/api/books");
  const books = list.body.books;
  if (
    books.length !== 3 ||
    books.filter((book) => book.completed).length !== 2 ||
    books.filter((book) => book.ownership === "wishlist").length !== 1 ||
    books.filter((book) => book.ownership === "owned").length !== 1 ||
    books.filter((book) => book.ownership === "none").length !== 1
  ) {
    throw new Error(`compteurs: ${JSON.stringify(books)}`);
  }

  await stopServer(server);
  server = startServer();
  await waitForServer(server);
  const restarted = await jsonRequest(`/api/books/${readOnly.body.id}/reading`);
  if (restarted.body.reading?.id !== sheet.body.reading.id || restarted.body.book.ownership !== "none") {
    throw new Error("la création n'a pas survécu au redémarrage");
  }
  console.log("d1-add-read.mjs : ok");
} finally {
  await stopServer(server);
}
