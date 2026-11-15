/// <reference path="../worker-configuration.d.ts" />
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import worker from "../src/worker/index.ts";

const issuer = "https://exemple.cloudflareaccess.com";
const audience = "aud-mcp-test";
const hostname = "mcp.exemple.test";
const serviceClientId = "ab12cd34.access";
const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
const jwk = await exportJWK(publicKey);
jwk.alg = "RS256";
jwk.kid = "clef-mcp";
jwk.use = "sig";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  if (url === `${issuer}/cdn-cgi/access/certs`) {
    return new Response(JSON.stringify({ keys: [jwk] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return originalFetch(input, init);
};

type Bound = {
  sql: string;
  params: unknown[];
};

function library() {
  const sqlite = new DatabaseSync(":memory:");
  const statements: string[] = [];
  sqlite.exec(`
    CREATE TABLE books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      ownership TEXT NOT NULL,
      category TEXT,
      collection TEXT,
      cover_key TEXT
    );
    CREATE TABLE readings (
      id TEXT PRIMARY KEY,
      book_id TEXT NOT NULL,
      status TEXT NOT NULL,
      started_on TEXT,
      finished_on TEXT,
      location TEXT,
      rating INTEGER
    );
  `);
  return {
    statements,
    sqlite,
    prepare(sql: string) {
      statements.push(sql);
      if (!/^\s*(select|insert)\b/i.test(sql)) {
        throw new Error(`écriture inattendue: ${sql}`);
      }
      return {
        bind(...params: unknown[]): Bound & {
          all: () => Promise<{ results: unknown[] }>;
          first: () => Promise<unknown>;
        } {
          return {
            sql,
            params,
            async all() {
              return { results: sqlite.prepare(sql).all(...(params as never[])) };
            },
            async first() {
              return sqlite.prepare(sql).get(...(params as never[])) ?? null;
            },
          };
        },
      };
    },
    async batch(items: Bound[]) {
      for (const item of items) {
        statements.push(item.sql);
        sqlite.prepare(item.sql).run(...(item.params as never[]));
      }
    },
  };
}

const db = library();
let coverReads = 0;
const covers = new Proxy(
  {},
  {
    get() {
      coverReads += 1;
      throw new Error("r2");
    },
  },
);

async function token() {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ type: "app", common_name: serviceClientId, sub: "" })
    .setProtectedHeader({ alg: "RS256", kid: "clef-mcp" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt(now)
    .setExpirationTime(now + 120)
    .sign(privateKey);
}

function call(args: unknown, jwt: string | null, database: object = db) {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "add_book", arguments: args },
  });
  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "content-length": String(new TextEncoder().encode(body).byteLength),
  };
  if (jwt) {
    headers["cf-access-jwt-assertion"] = jwt;
  }
  return worker.fetch(
    new Request(`https://${hostname}/mcp`, {
      method: "POST",
      headers,
      body,
    }) as never,
    {
      TEAM_DOMAIN: issuer,
      POLICY_AUD: "aud-site-humain",
      ACCESS_LOCAL_EXEMPT: "dev-only",
      MCP_HOSTNAME: hostname,
      MCP_POLICY_AUD: audience,
      MCP_SERVICE_CLIENT_ID: serviceClientId,
      DB: database,
      COVERS: covers,
    } as never,
  );
}

async function payload(response: Response) {
  const text = await response.text();
  const dataLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("data:"));
  return JSON.parse(dataLine ? dataLine.slice("data:".length).trim() : text) as {
    result?: {
      isError?: boolean;
      content?: Array<{ text?: string }>;
      structuredContent?: {
        created?: boolean;
        book?: {
          id: string;
          title: string;
          author: string;
          ownership: string;
          category: string | null;
          collection: string | null;
          read: boolean;
        };
      };
    };
  };
}

const boom = new Proxy(
  {},
  {
    get() {
      throw new Error("db");
    },
  },
);
const denied = await call({ title: "Secret", author: "Ada" }, null, boom);
assert.equal(denied.status, 401);
assert.equal(coverReads, 0);

const jwt = await token();
const before = db.statements.length;
const invalid = await payload(await call({ title: "   ", author: "Ada" }, jwt));
assert.equal(invalid.result?.isError, true);
assert.equal(invalid.result?.structuredContent, undefined);
assert.equal(db.statements.length, before);

const longTitle = await payload(
  await call({ title: "a".repeat(201), author: "Ada" }, jwt),
);
assert.equal(longTitle.result?.isError, true);

const badOwnership = await payload(
  await call({ title: "Titre", author: "Ada", ownership: "borrowed" }, jwt),
);
assert.equal(badOwnership.result?.isError, true);

const badCategory = await payload(
  await call({ title: "Titre", author: "Ada", category: "Roman" }, jwt),
);
assert.equal(badCategory.result?.isError, true);

const longCollection = await payload(
  await call({ title: "Titre", author: "Ada", collection: "a".repeat(81) }, jwt),
);
assert.equal(longCollection.result?.isError, true);
assert.equal(db.statements.length, before);
assert.equal(coverReads, 0);

const created = await payload(
  await call(
    {
      title: "  Mémoires  ",
      author: " Émile Zola ",
      ownership: "owned",
      read: true,
      category: "novel",
      collection: "  Les Rougon-Macquart  ",
    },
    jwt,
  ),
);
assert.equal(created.result?.isError, undefined);
assert.equal(created.result?.structuredContent?.created, true);
assert.equal(created.result?.structuredContent?.book?.title, "Mémoires");
assert.equal(created.result?.structuredContent?.book?.author, "Émile Zola");
assert.equal(created.result?.structuredContent?.book?.ownership, "owned");
assert.equal(created.result?.structuredContent?.book?.category, "novel");
assert.equal(created.result?.structuredContent?.book?.collection, "Les Rougon-Macquart");
assert.equal(created.result?.structuredContent?.book?.read, true);
assert.match(created.result?.content?.[0]?.text ?? "", /est ajouté/);
assert.match(created.result?.content?.[0]?.text ?? "", /j’ai lu/);
assert.match(created.result?.content?.[0]?.text ?? "", /Roman/);
const createdId = created.result?.structuredContent?.book?.id;
assert.equal(typeof createdId, "string");

const rows = db.sqlite.prepare("SELECT title, author, ownership, category, collection, cover_key FROM books").all() as Array<{
  title: string;
  author: string;
  ownership: string;
  category: string;
  collection: string;
  cover_key: string | null;
}>;
assert.equal(rows.length, 1);
assert.equal(rows[0]?.cover_key, null);
const readings = db.sqlite.prepare("SELECT status FROM readings").all() as Array<{ status: string }>;
assert.deepEqual(readings.map((row) => row.status), ["read"]);

const duplicate = await payload(
  await call(
    { title: "memoires", author: "emile zola", ownership: "wishlist" },
    jwt,
  ),
);
assert.equal(duplicate.result?.structuredContent?.created, false);
assert.equal(duplicate.result?.structuredContent?.book?.id, createdId);
assert.equal(duplicate.result?.structuredContent?.book?.ownership, "owned");
assert.match(duplicate.result?.content?.[0]?.text ?? "", /déjà dans la bibliothèque/);
assert.match(duplicate.result?.content?.[0]?.text ?? "", /Rien n'a été ajouté/);
assert.equal(
  (db.sqlite.prepare("SELECT COUNT(*) AS total FROM books").get() as { total: number }).total,
  1,
);

for (const sql of db.statements) {
  assert.equal(sql.includes("Mémoires"), false);
  assert.equal(sql.includes("memoires"), false);
}
assert.equal(coverReads, 0);

console.log("mcp-add-book.test.ts : ok");
