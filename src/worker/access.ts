import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export const LOCAL_EXEMPT_VALUE = "dev-only";

export type AccessEnv = {
  TEAM_DOMAIN?: string;
  POLICY_AUD?: string;
  ACCESS_LOCAL_EXEMPT?: string;
};

export type AccessMode =
  | { kind: "local" }
  | { kind: "closed" }
  | { kind: "protected"; issuer: string; audience: string };

const keySets = new Map<string, JWTVerifyGetKey>();

function trimmed(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function parseIssuer(value: string | undefined): string | null {
  const raw = trimmed(value);
  if (raw === "") {
    return null;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") {
    return null;
  }
  if (url.username || url.password || url.port || url.search || url.hash) {
    return null;
  }
  if (url.pathname !== "/" && url.pathname !== "") {
    return null;
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.cloudflareaccess\.com$/.test(url.hostname)) {
    return null;
  }
  return url.origin;
}

export function parseAudience(value: string | undefined): string | null {
  const raw = trimmed(value);
  if (raw === "" || raw.length > 200 || /\s/.test(raw)) {
    return null;
  }
  return raw;
}

export function resolveAccess(env: AccessEnv): AccessMode {
  const teamPresent = trimmed(env.TEAM_DOMAIN) !== "";
  const audiencePresent = trimmed(env.POLICY_AUD) !== "";
  if (!teamPresent && !audiencePresent) {
    return env.ACCESS_LOCAL_EXEMPT === LOCAL_EXEMPT_VALUE ? { kind: "local" } : { kind: "closed" };
  }
  const issuer = parseIssuer(env.TEAM_DOMAIN);
  const audience = parseAudience(env.POLICY_AUD);
  if (!issuer || !audience) {
    return { kind: "closed" };
  }
  return { kind: "protected", issuer, audience };
}

export function readAccessToken(
  request: Request,
): { value: string; source: "header" | "cookie" } | null {
  const header = request.headers.get("cf-access-jwt-assertion")?.trim() ?? "";
  if (header !== "") {
    return { value: header, source: "header" };
  }
  const cookie = request.headers.get("cookie") ?? "";
  const match = /(?:^|;\s*)CF_Authorization=([^;]+)/.exec(cookie);
  if (!match?.[1]) {
    return null;
  }
  try {
    const value = decodeURIComponent(match[1]).trim();
    return value === "" ? null : { value, source: "cookie" };
  } catch {
    return null;
  }
}

export function requestIsSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");
  let target: string;
  try {
    target = new URL(request.url).origin;
  } catch {
    return false;
  }
  if (site === "cross-site" || site === "same-site") {
    return false;
  }
  if (origin && origin !== target) {
    return false;
  }
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true;
  }
  if (site === "same-origin" || site === "none") {
    return true;
  }
  if (origin === target) {
    return true;
  }
  return !origin && !site;
}

function denied(message: string, status: number): Response {
  return Response.json(
    { error: message },
    { status, headers: { "cache-control": "no-store" } },
  );
}

function keysFor(issuer: string): JWTVerifyGetKey {
  const existing = keySets.get(issuer);
  if (existing) {
    return existing;
  }
  const created = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  keySets.set(issuer, created);
  return created;
}

export async function accessTokenIsValid(
  token: string,
  issuer: string,
  audience: string,
  keys: JWTVerifyGetKey,
): Promise<boolean> {
  try {
    await jwtVerify(token, keys, {
      issuer,
      audience,
      algorithms: ["RS256"],
      clockTolerance: 0,
    });
    return true;
  } catch {
    return false;
  }
}

export async function guardApi(
  request: Request,
  env: AccessEnv,
  keys?: JWTVerifyGetKey,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/")) {
    return null;
  }

  const mode = resolveAccess(env);
  if (mode.kind === "local") {
    return null;
  }
  if (mode.kind === "closed") {
    return denied("L'accès n'est pas configuré.", 401);
  }
  if (!requestIsSameOrigin(request)) {
    return denied("Accès refusé.", 403);
  }

  const token = readAccessToken(request);
  if (!token) {
    return denied("Accès refusé.", 401);
  }
  const valid = await accessTokenIsValid(
    token.value,
    mode.issuer,
    mode.audience,
    keys ?? keysFor(mode.issuer),
  );
  if (!valid) {
    return denied("Accès refusé.", 401);
  }
  return null;
}
