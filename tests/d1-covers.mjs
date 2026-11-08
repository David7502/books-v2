import { spawn } from "node:child_process";
import { once } from "node:events";

const persist = ".wrangler/cover-test";
const port = 8795;
const base = `http://127.0.0.1:${port}`;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
const replacement = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "base64",
);
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');

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
      "9245",
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
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

function form(fields, file) {
  const body = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    body.set(key, value);
  }
  if (file) {
    body.set("cover", new File([file.bytes], file.name, { type: file.type }));
  }
  return body;
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
  const readOnly = await jsonRequest("/api/books", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      title: "Sans image",
      author: "Lina",
      ownership: "owned",
      read: true,
    }),
  });
  if (readOnly.status !== 201 || readOnly.body.completed !== true || readOnly.body.coverKey !== null) {
    throw new Error(`ajout lu sans image: ${readOnly.status} ${JSON.stringify(readOnly.body)}`);
  }
  const missing = await fetch(`${base}/api/books/${readOnly.body.id}/cover`);
  if (missing.status !== 404) {
    throw new Error("un livre sans couverture a renvoyé une image");
  }

  const rejected = await jsonRequest("/api/books", {
    method: "POST",
    body: form(
      { title: "Mauvais", author: "Lina", ownership: "none", read: "true" },
      { bytes: svg, name: "photo.jpg", type: "image/jpeg" },
    ),
  });
  const afterReject = await jsonRequest("/api/books");
  if (rejected.status !== 400 || afterReject.body.books.length !== 1) {
    throw new Error("une fausse image a créé un livre");
  }

  const created = await jsonRequest("/api/books", {
    method: "POST",
    body: form(
      { title: "Avec image", author: "Noa", ownership: "none", read: "true" },
      { bytes: png, name: "couverture.png", type: "image/png" },
    ),
  });
  if (
    created.status !== 201 ||
    created.body.completed !== true ||
    created.body.ownership !== "none" ||
    typeof created.body.coverKey !== "string" ||
    !created.body.coverKey.startsWith("covers/") ||
    JSON.stringify(created.body).includes(png.toString("base64"))
  ) {
    throw new Error(`création avec image: ${created.status} ${JSON.stringify(created.body)}`);
  }

  const image = await fetch(`${base}/api/books/${created.body.id}/cover`);
  const bytes = Buffer.from(await image.arrayBuffer());
  if (
    image.status !== 200 ||
    image.headers.get("content-type") !== "image/png" ||
    image.headers.get("x-content-type-options") !== "nosniff" ||
    !bytes.equals(png)
  ) {
    throw new Error("la lecture de la couverture ne rend pas l'image");
  }

  const lied = await jsonRequest(`/api/books/${created.body.id}/cover`, {
    method: "PUT",
    headers: { "content-type": "image/jpeg" },
    body: png,
  });
  const svgPut = await jsonRequest(`/api/books/${created.body.id}/cover`, {
    method: "PUT",
    headers: { "content-type": "image/svg+xml" },
    body: svg,
  });
  const unchanged = await jsonRequest(`/api/books/${created.body.id}/reading`);
  const still = await fetch(`${base}/api/books/${created.body.id}/cover`);
  if (
    lied.status !== 400 ||
    svgPut.status !== 400 ||
    unchanged.body.book.coverKey !== created.body.coverKey ||
    unchanged.body.reading.status !== "read" ||
    !Buffer.from(await still.arrayBuffer()).equals(png)
  ) {
    throw new Error("un remplacement refusé a changé la couverture ou la fiche");
  }

  const huge = new Uint8Array(2 * 1024 * 1024 + 1);
  huge.set(png);
  const heavy = await jsonRequest(`/api/books/${created.body.id}/cover`, {
    method: "PUT",
    headers: { "content-type": "image/png" },
    body: huge,
  });
  if (heavy.status !== 400) {
    throw new Error("une image trop lourde a été acceptée");
  }

  const replaced = await jsonRequest(`/api/books/${created.body.id}/cover`, {
    method: "PUT",
    headers: { "content-type": "image/png" },
    body: replacement,
  });
  const nextImage = await fetch(`${base}/api/books/${replaced.body.id}/cover?v=${replaced.body.coverKey}`);
  if (
    replaced.body.coverKey === created.body.coverKey ||
    !Buffer.from(await nextImage.arrayBuffer()).equals(replacement)
  ) {
    throw new Error("le remplacement n'a pas changé l'image");
  }

  const list = await jsonRequest("/api/books");
  if (
    list.body.books.length !== 2 ||
    list.body.books.filter((book) => book.completed).length !== 2 ||
    list.body.books.filter((book) => book.ownership === "owned").length !== 1
  ) {
    throw new Error("les compteurs ont bougé avec la couverture");
  }

  await stopServer(server);
  server = startServer();
  await waitForServer(server);
  const restarted = await fetch(`${base}/api/books/${created.body.id}/cover`);
  if (!Buffer.from(await restarted.arrayBuffer()).equals(replacement)) {
    throw new Error("la couverture n'a pas survécu au redémarrage");
  }
  console.log("d1-covers.mjs : ok");
} finally {
  await stopServer(server);
}
