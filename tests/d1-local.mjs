import { spawn } from "node:child_process";
import { once } from "node:events";

const persist = ".wrangler/test-state";
const port = 8791;
const base = `http://127.0.0.1:${port}`;
const injection = "Robert'); DROP TABLE books;--";

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

function startServer() {
  const child = spawn(
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
      "9241",
      "--persist-to",
      persist,
      "--show-interactive-dev-session",
      "false",
    ],
    { stdio: ["ignore", "pipe", "pipe"], env: process.env },
  );
  child.on("exit", (code) => {
    child.exitCode = code;
  });
  return child;
}

async function stopServer(child) {
  if (!child || child.exitCode !== undefined && child.exitCode !== null) {
    return;
  }
  child.kill("SIGTERM");
  const exited = await Promise.race([
    once(child, "exit").then(() => true),
    new Promise((resolve) => setTimeout(() => resolve(false), 2000)),
  ]);
  if (!exited) {
    child.kill("SIGKILL");
  }
}

async function jsonRequest(path, init) {
  const response = await fetch(`${base}${path}`, init);
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text.slice(0, 300);
    }
  }
  return { status: response.status, body };
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
await run("npx", [
  "wrangler",
  "d1",
  "execute",
  "books-v2",
  "--local",
  "--persist-to",
  persist,
  "--file",
  "seed/demo.sql",
]);

let server = startServer();
try {
  await waitForServer(server);
  const seeded = await jsonRequest("/api/books");
  if (!seeded.body?.books) {
    throw new Error(`liste illisible: ${seeded.status} ${JSON.stringify(seeded.body)}`);
  }
  const brume = seeded.body.books.find((book) => book.id === "demo-brume");
  if (!brume || brume.completed !== true || brume.ownership !== "owned") {
    throw new Error(`seed inattendu: ${JSON.stringify(brume)}`);
  }

  const renamed = await jsonRequest("/api/books/demo-brume", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "La brume persistée",
      author: brume.author,
      ownership: "owned",
    }),
  });
  if (renamed.status !== 200 || renamed.body.completed !== true) {
    throw new Error(`mise à jour seed: ${renamed.status}`);
  }
  await run("npx", [
    "wrangler",
    "d1",
    "execute",
    "books-v2",
    "--local",
    "--persist-to",
    persist,
    "--file",
    "seed/demo.sql",
  ]);
  const afterSeed = await jsonRequest("/api/books");
  const still = afterSeed.body.books.find((book) => book.id === "demo-brume");
  if (still.title !== "La brume persistée" || still.completed !== true) {
    throw new Error("le seed a écrasé une modification");
  }

  const created = await jsonRequest("/api/books", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: `  ${injection}  `,
      author: "Ada",
      ownership: "wishlist",
    }),
  });
  if (created.status !== 201 || created.body.title !== injection) {
    throw new Error(`création: ${created.status} ${JSON.stringify(created.body)}`);
  }
  if (created.body.completed !== false || created.body.coverKey !== null) {
    throw new Error("nouveau livre inattendu");
  }

  await run("npx", [
    "wrangler",
    "d1",
    "execute",
    "books-v2",
    "--local",
    "--persist-to",
    persist,
    "--command",
    `INSERT INTO readings (id, book_id, status) VALUES ('reading-${created.body.id}', '${created.body.id}', 'read')`,
  ]);

  const updated = await jsonRequest(`/api/books/${created.body.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: injection,
      author: "Auteur modifié",
      ownership: "owned",
    }),
  });
  if (
    updated.status !== 200 ||
    updated.body.id !== created.body.id ||
    updated.body.completed !== true ||
    updated.body.author !== "Auteur modifié"
  ) {
    throw new Error(`lecture non conservée: ${JSON.stringify(updated.body)}`);
  }

  const invalid = await jsonRequest("/api/books", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "   ", author: "Ada", ownership: "owned" }),
  });
  if (invalid.status !== 400 || String(invalid.body.error).includes("SQL")) {
    throw new Error(`validation: ${invalid.status} ${JSON.stringify(invalid.body)}`);
  }
  const missing = await jsonRequest("/api/books/livre-absent", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title: "Absent", author: "Ada", ownership: "none" }),
  });
  if (missing.status !== 404) {
    throw new Error(`livre absent: ${missing.status}`);
  }
  const unknown = await jsonRequest("/api/autre");
  if (unknown.status !== 404) {
    throw new Error(`route inconnue: ${unknown.status}`);
  }

  const savedId = created.body.id;
  await stopServer(server);
  server = startServer();
  await waitForServer(server);
  const restarted = await jsonRequest("/api/books");
  const kept = restarted.body.books.find((book) => book.id === savedId);
  if (!kept || kept.author !== "Auteur modifié" || kept.completed !== true) {
    throw new Error("le livre n'a pas survécu au redémarrage");
  }
  const tables = restarted.body.books.find((book) => book.id === "demo-brume");
  if (!tables) {
    throw new Error("la table books a été supprimée");
  }
  console.log("d1-local.mjs : ok");
} finally {
  await stopServer(server);
}
