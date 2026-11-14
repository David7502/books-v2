/// <reference path="../worker-configuration.d.ts" />
import assert from "node:assert/strict";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import worker from "../src/worker/index.ts";
import { MCP_MAX_BODY_BYTES } from "../src/worker/mcp.ts";

const issuer = "https://exemple.cloudflareaccess.com";
const audience = "aud-mcp-test";
const hostname = "mcp.exemple.test";
const serviceClientId = "ab12cd34.access";
const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
const other = await generateKeyPair("RS256", { extractable: true });
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

const mcpEnv = {
  TEAM_DOMAIN: issuer,
  POLICY_AUD: "aud-site-humain",
  ACCESS_LOCAL_EXEMPT: "dev-only",
  MCP_HOSTNAME: hostname,
  MCP_POLICY_AUD: audience,
  MCP_SERVICE_CLIENT_ID: serviceClientId,
};

function boom(label: string): object {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(label);
      },
    },
  );
}

async function sign(options?: {
  key?: CryptoKey;
  iss?: string;
  aud?: string;
  exp?: number;
  claims?: Record<string, unknown>;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims = options?.claims ?? {
    type: "app",
    common_name: serviceClientId,
    sub: "",
  };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid: "clef-mcp" })
    .setIssuer(options?.iss ?? issuer)
    .setAudience(options?.aud ?? audience)
    .setIssuedAt(now)
    .setExpirationTime(options?.exp ?? now + 120)
    .sign(options?.key ?? privateKey);
}

function mcpRequest(
  method: string,
  params: unknown,
  token: string | null,
  extra?: { url?: string; headers?: Record<string, string>; body?: string },
): Request {
  const body =
    extra?.body ??
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    });
  const headers = new Headers({
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "content-length": String(new TextEncoder().encode(body).byteLength),
  });
  if (token) {
    headers.set("cf-access-jwt-assertion", token);
  }
  for (const [name, value] of Object.entries(extra?.headers ?? {})) {
    headers.set(name, value);
  }
  return new Request(extra?.url ?? `https://${hostname}/mcp`, {
    method: "POST",
    headers,
    body,
  });
}

async function readMcp(response: Response): Promise<unknown> {
  const text = await response.text();
  const dataLine = text
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("data:"));
  const json = dataLine ? dataLine.slice("data:".length).trim() : text;
  return JSON.parse(json);
}

async function callWorker(request: Request, env: Record<string, unknown> = mcpEnv) {
  return worker.fetch(
    request as never,
    {
      ...env,
      DB: boom("db"),
      COVERS: boom("r2"),
    } as never,
  );
}

const token = await sign();
const initialize = await callWorker(
  mcpRequest("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test", version: "0" },
  }, token),
);
assert.equal(initialize.status, 200);
const initialized = (await readMcp(initialize)) as {
  result?: { serverInfo?: { name?: string } };
};
assert.equal(initialized.result?.serverInfo?.name, "books-v2");

const listed = await callWorker(mcpRequest("tools/list", {}, token));
assert.equal(listed.status, 200);
const tools = (await readMcp(listed)) as {
  result?: { tools?: Array<{ name: string }> };
};
assert.deepEqual(
  tools.result?.tools?.map((tool) => tool.name),
  ["ping", "search_books"],
);

const called = await callWorker(
  mcpRequest("tools/call", { name: "ping", arguments: {} }, token),
);
assert.equal(called.status, 200);
const pong = (await readMcp(called)) as {
  result?: { content?: Array<{ text?: string }> };
};
assert.equal(pong.result?.content?.[0]?.text, "pong");

const secret = "secret-qui-ne-doit-pas-sortir";
const cases: Array<{ name: string; request: Request; status: number }> = [
  { name: "absent", request: mcpRequest("tools/list", {}, null), status: 401 },
  {
    name: "forged",
    request: mcpRequest("tools/list", {}, await sign({ key: other.privateKey }), {
      headers: { "cf-access-client-secret": secret, "cf-access-client-id": serviceClientId },
    }),
    status: 401,
  },
  {
    name: "expired",
    request: mcpRequest(
      "tools/list",
      {},
      await sign({ exp: Math.floor(Date.now() / 1000) - 120 }),
    ),
    status: 401,
  },
  {
    name: "issuer",
    request: mcpRequest(
      "tools/list",
      {},
      await sign({ iss: "https://autre.cloudflareaccess.com" }),
    ),
    status: 401,
  },
  {
    name: "audience",
    request: mcpRequest("tools/list", {}, await sign({ aud: "aud-site-humain" })),
    status: 401,
  },
  {
    name: "identity",
    request: mcpRequest(
      "tools/list",
      {},
      await sign({ claims: { type: "app", common_name: "autre.access", sub: "" } }),
      { headers: { "cf-access-client-id": serviceClientId } },
    ),
    status: 401,
  },
  {
    name: "user",
    request: mcpRequest(
      "tools/list",
      {},
      await sign({
        claims: { type: "app", sub: "personne", email: "personne@exemple.test" },
      }),
    ),
    status: 401,
  },
  {
    name: "header-only",
    request: mcpRequest("tools/list", {}, null, {
      headers: { "cf-access-client-id": serviceClientId, "cf-access-client-secret": secret },
    }),
    status: 401,
  },
  {
    name: "origin",
    request: mcpRequest("tools/list", {}, token, {
      headers: { origin: "https://livres.exemple.test" },
    }),
    status: 403,
  },
  {
    name: "host",
    request: mcpRequest("tools/list", {}, token, {
      url: "https://livres.exemple.test/mcp",
    }),
    status: 404,
  },
];

for (const item of cases) {
  const response = await callWorker(item.request);
  const text = await response.text();
  assert.equal(response.status, item.status, item.name);
  assert.equal(text.includes(secret), false, item.name);
  assert.equal(text.includes(serviceClientId), false, item.name);
}

const unconfigured = await callWorker(
  mcpRequest("tools/list", {}, token),
  { ...mcpEnv, MCP_POLICY_AUD: "" },
);
assert.equal(unconfigured.status, 401);

const booksOnMcpHost = await callWorker(
  new Request(`https://${hostname}/api/books`),
);
assert.equal(booksOnMcpHost.status, 404);

const humanApi = await callWorker(
  new Request("https://livres.exemple.test/api/books", {
    headers: { "cf-access-client-id": serviceClientId },
  }),
);
assert.equal(humanApi.status, 401);

const heavy = "x".repeat(MCP_MAX_BODY_BYTES + 1);
const tooBig = await callWorker(
  new Request(`https://${hostname}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(heavy.length),
      "cf-access-jwt-assertion": token,
    },
    body: heavy,
  }),
);
assert.equal(tooBig.status, 413);

console.log("mcp.test.ts : ok");
