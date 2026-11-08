/// <reference path="../worker-configuration.d.ts" />
import assert from "node:assert/strict";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { guardApi, resolveAccess } from "../src/worker/access.ts";
import worker from "../src/worker/index.ts";

const issuer = "https://exemple.cloudflareaccess.com";
const audience = "aud-de-test";
const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
const other = await generateKeyPair("RS256", { extractable: true });
const jwk = await exportJWK(publicKey);
jwk.alg = "RS256";
jwk.kid = "clef-test";
const keys = createLocalJWKSet({ keys: [jwk] });

const protectedEnv = {
  TEAM_DOMAIN: issuer,
  POLICY_AUD: audience,
  ACCESS_LOCAL_EXEMPT: "",
};
const closedEnv = {
  TEAM_DOMAIN: "",
  POLICY_AUD: "",
  ACCESS_LOCAL_EXEMPT: "",
};
const localEnv = {
  TEAM_DOMAIN: "",
  POLICY_AUD: "",
  ACCESS_LOCAL_EXEMPT: "dev-only",
};

async function sign(options?: {
  key?: CryptoKey;
  iss?: string;
  aud?: string;
  exp?: number;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: "personne-test" })
    .setProtectedHeader({ alg: "RS256", kid: "clef-test" })
    .setIssuer(options?.iss ?? issuer)
    .setAudience(options?.aud ?? audience)
    .setIssuedAt(now)
    .setExpirationTime(options?.exp ?? now + 120)
    .sign(options?.key ?? privateKey);
}

function request(url: string, init?: RequestInit): Request {
  return new Request(url, init);
}

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

assert.equal(resolveAccess(closedEnv).kind, "closed");
assert.equal(resolveAccess({ ...closedEnv, ACCESS_LOCAL_EXEMPT: "true" }).kind, "closed");
assert.equal(resolveAccess(localEnv).kind, "local");
assert.equal(
  resolveAccess({ TEAM_DOMAIN: "http://localhost", POLICY_AUD: audience, ACCESS_LOCAL_EXEMPT: "dev-only" }).kind,
  "closed",
);
assert.equal(
  resolveAccess({ TEAM_DOMAIN: issuer, POLICY_AUD: "", ACCESS_LOCAL_EXEMPT: "dev-only" }).kind,
  "closed",
);
assert.equal(resolveAccess(protectedEnv).kind, "protected");

const closed = await guardApi(
  request("http://localhost/api/books", { headers: { host: "localhost" } }),
  closedEnv,
);
assert.equal(closed?.status, 401);
const closedBody = (await closed?.json()) as { error?: string };
assert.equal(closedBody.error, "L'accès n'est pas configuré.");

const localOtherHost = await guardApi(request("https://books.example/api/books"), localEnv);
assert.equal(localOtherHost, null);

const emailOnly = await guardApi(
  request("https://books.example/api/books", {
    headers: { "cf-access-authenticated-user-email": "personne@exemple.test" },
  }),
  protectedEnv,
  keys,
);
assert.equal(emailOnly?.status, 401);

const good = await sign();
assert.equal(
  await guardApi(
    request("https://books.example/api/books", {
      headers: { "cf-access-jwt-assertion": good },
    }),
    protectedEnv,
    keys,
  ),
  null,
);
assert.equal(
  await guardApi(
    request("https://books.example/api/books", {
      method: "POST",
      headers: {
        "cf-access-jwt-assertion": good,
        origin: "https://books.example",
        "sec-fetch-site": "same-origin",
      },
    }),
    protectedEnv,
    keys,
  ),
  null,
);

for (const token of [
  await sign({ key: other.privateKey }),
  await sign({ exp: Math.floor(Date.now() / 1000) - 120 }),
  await sign({ iss: "https://autre.cloudflareaccess.com" }),
  await sign({ aud: "autre-aud" }),
  `${Buffer.from(JSON.stringify({ alg: "none", kid: "clef-test" })).toString("base64url")}.${Buffer.from(JSON.stringify({ iss: issuer, aud: audience, exp: Math.floor(Date.now() / 1000) + 120 })).toString("base64url")}.`,
]) {
  const refused = await guardApi(
    request("https://books.example/api/books", {
      headers: { "cf-access-jwt-assertion": token },
    }),
    protectedEnv,
    keys,
  );
  assert.equal(refused?.status, 401);
  const body = (await refused?.json()) as { error?: string };
  assert.equal(body.error, "Accès refusé.");
  assert.equal(JSON.stringify(body).includes("exemple"), false);
}

const crossSite = await guardApi(
  request("https://books.example/api/books/demo/cover", {
    headers: {
      cookie: `CF_Authorization=${encodeURIComponent(good)}`,
      "sec-fetch-site": "cross-site",
    },
  }),
  protectedEnv,
  keys,
);
assert.equal(crossSite?.status, 403);

const foreignPost = await worker.fetch(
  request("https://books.example/api/books", {
    method: "POST",
    headers: {
      "cf-access-jwt-assertion": good,
      origin: "https://evil.example",
      "content-type": "application/json",
    },
    body: JSON.stringify({ title: "secret" }),
  }) as never,
  {
    ...protectedEnv,
    DB: boom("db"),
    COVERS: boom("r2"),
  } as never,
);
assert.equal(foreignPost.status, 403);

const originalFetch = globalThis.fetch;
let network = false;
globalThis.fetch = (async () => {
  network = true;
  throw new Error("réseau");
}) as typeof fetch;
try {
  const missing = await worker.fetch(
    request("http://localhost/api/books", { headers: { host: "localhost" } }) as never,
    {
      ...protectedEnv,
      DB: boom("db"),
      COVERS: boom("r2"),
    } as never,
  );
  assert.equal(missing.status, 401);
  assert.equal(network, false);
  const unconfigured = await worker.fetch(
    request("https://books.example/api/health") as never,
    {
      ...closedEnv,
      DB: boom("db"),
      COVERS: boom("r2"),
    } as never,
  );
  assert.equal(unconfigured.status, 401);
  assert.equal(network, false);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("access.test.ts : ok");
