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

function library() {
  const sqlite = new DatabaseSync(":memory:");
  const statements: string[] = [];
  sqlite.exec(`
    CREATE TABLE books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      ownership TEXT NOT NULL,
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
    INSERT INTO books (id, title, author, ownership) VALUES
      ('demo-brume', 'La brume du phare', 'Ada Quenelle', 'owned'),
      ('demo-horloge', 'L''horloge sans aiguilles', 'Milo Sablier', 'wishlist'),
      ('demo-jardin', 'Le jardin sous la gare', 'Nina Calebasse', 'none'),
      ('demo-pourcent', '100% certain', 'Lina', 'none');
    INSERT INTO readings (id, book_id, status, started_on, finished_on, rating) VALUES
      ('r-brume', 'demo-brume', 'read', '2020-01-01', '2020-02-01', 5),
      ('r-jardin', 'demo-jardin', 'read', NULL, NULL, NULL);
  `);
  return {
    statements,
    prepare(sql: string) {
      statements.push(sql);
      if (!/^\s*select\b/i.test(sql)) {
        throw new Error(`écriture interdite: ${sql}`);
      }
      const statement = sqlite.prepare(sql);
      return {
        bind(...params: unknown[]) {
          return {
            async all() {
              return { results: statement.all(...(params as never[])) };
            },
            async first() {
              return statement.get(...(params as never[])) ?? null;
            },
          };
        },
      };
    },
  };
}

const db = library();
const covers = new Proxy(
  {},
  {
    get() {
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

function call(name: string, args: unknown, jwt: string) {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name, arguments: args },
  });
  return worker.fetch(
    new Request(`https://${hostname}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        "content-length": String(new TextEncoder().encode(body).byteLength),
        "cf-access-jwt-assertion": jwt,
      },
      body,
    }) as never,
    {
      TEAM_DOMAIN: issuer,
      POLICY_AUD: "aud-site-humain",
      ACCESS_LOCAL_EXEMPT: "",
      MCP_HOSTNAME: hostname,
      MCP_POLICY_AUD: audience,
      MCP_SERVICE_CLIENT_ID: serviceClientId,
      DB: db,
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
      structuredContent?: { total?: number; books?: Array<{ id: string; title: string }> };
    };
    error?: { message?: string };
  };
}

const jwt = await token();
const found = await payload(await call("search_books", { query: "BRUME" }, jwt));
assert.equal(found.result?.isError, undefined);
assert.equal(found.result?.structuredContent?.total, 1);
assert.equal(found.result?.structuredContent?.books?.[0]?.id, "demo-brume");
assert.match(found.result?.content?.[0]?.text ?? "", /La brume du phare/);
assert.match(found.result?.content?.[0]?.text ?? "", /j’ai lu/);
assert.match(found.result?.content?.[0]?.text ?? "", /note 5/);

const owned = await payload(await call("search_books", { status: "owned" }, jwt));
assert.deepEqual(
  owned.result?.structuredContent?.books?.map((book) => book.id),
  ["demo-brume"],
);

const read = await payload(await call("search_books", { status: "read" }, jwt));
assert.equal(read.result?.structuredContent?.total, 2);
assert.deepEqual(
  read.result?.structuredContent?.books?.map((book) => book.id).sort(),
  ["demo-brume", "demo-jardin"],
);

const wished = await payload(await call("search_books", { status: "wishlist" }, jwt));
assert.deepEqual(
  wished.result?.structuredContent?.books?.map((book) => book.id),
  ["demo-horloge"],
);

const capped = await payload(await call("search_books", { limit: 1 }, jwt));
assert.equal(capped.result?.structuredContent?.total, 4);
assert.equal(capped.result?.structuredContent?.books?.length, 1);
assert.match(capped.result?.content?.[0]?.text ?? "", /1 affiché sur 4/);

const empty = await payload(await call("search_books", { query: "zzzz" }, jwt));
assert.equal(empty.result?.structuredContent?.total, 0);
assert.equal(empty.result?.structuredContent?.books?.length, 0);
assert.match(empty.result?.content?.[0]?.text ?? "", /Aucun livre/);

const wildcard = await payload(await call("search_books", { query: "%" }, jwt));
assert.deepEqual(
  wildcard.result?.structuredContent?.books?.map((book) => book.id),
  ["demo-pourcent"],
);

const invalid = await payload(await call("search_books", { limit: 51 }, jwt));
assert.equal(invalid.result?.isError, true);
assert.equal(invalid.result?.structuredContent, undefined);

for (const sql of db.statements) {
  assert.match(sql, /^\s*select\b/i);
  assert.equal(sql.includes("100%"), false);
}

console.log("mcp-search.test.ts : ok");
