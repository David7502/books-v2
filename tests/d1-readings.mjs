import { spawn } from "node:child_process";
import { once } from "node:events";

const persist = ".wrangler/reading-sheet-test";
const port = 8793;
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
      "9243",
      "--persist-to",
      persist,
      "--show-interactive-dev-session",
      "false",
      "--var",
      "ACCESS_LOCAL_EXEMPT:dev-only",
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
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

const sheet = {
  status: "read",
  startedOn: "2020-01-01",
  finishedOn: "2020-02-01",
  location: "train",
  rating: 5,
};

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
  const seeded = await jsonRequest("/api/books/demo-brume/reading");
  if (
    seeded.status !== 200 ||
    seeded.body.ambiguous !== false ||
    seeded.body.reading?.status !== "read" ||
    seeded.body.book.ownership !== "owned"
  ) {
    throw new Error(`fiche de démo: ${seeded.status} ${JSON.stringify(seeded.body)}`);
  }
  const originalId = seeded.body.reading.id;

  const first = await jsonRequest("/api/books/demo-brume/reading", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(sheet),
  });
  const second = await jsonRequest("/api/books/demo-brume/reading", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...sheet, location: "canapé", rating: null }),
  });
  if (
    first.status !== 200 ||
    second.status !== 200 ||
    second.body.reading.id !== originalId ||
    second.body.reading.location !== "canapé" ||
    second.body.book.completed !== true
  ) {
    throw new Error("deux enregistrements n'ont pas visé la même fiche");
  }

  const wish = await jsonRequest("/api/books/demo-brume", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: seeded.body.book.title,
      author: seeded.body.book.author,
      ownership: "wishlist",
    }),
  });
  if (wish.body.ownership !== "wishlist" || wish.body.completed !== true) {
    throw new Error("la possession a modifié la lecture");
  }

  const badDate = await jsonRequest("/api/books/demo-brume/reading", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...sheet, startedOn: "2024-02-31" }),
  });
  const badRating = await jsonRequest("/api/books/demo-brume/reading", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...sheet, rating: 9 }),
  });
  if (badDate.status !== 400 || badRating.status !== 400) {
    throw new Error(`validation: ${badDate.status} ${badRating.status}`);
  }
  const unchanged = await jsonRequest("/api/books/demo-brume/reading");
  if (unchanged.body.reading.startedOn !== "2020-01-01") {
    throw new Error("une saisie invalide a modifié la fiche");
  }

  await stopServer(server);
  server = startServer();
  await waitForServer(server);
  const restarted = await jsonRequest("/api/books/demo-brume/reading");
  if (
    restarted.body.reading.id !== originalId ||
    restarted.body.reading.location !== "canapé" ||
    restarted.body.book.completed !== true
  ) {
    throw new Error("la fiche n'a pas survécu au redémarrage");
  }
  console.log("d1-readings.mjs : ok");
} finally {
  await stopServer(server);
}
