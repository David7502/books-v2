import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from "jose";
import { parseAudience, parseIssuer } from "./access.ts";

export const MCP_MAX_BODY_BYTES = 32 * 1024;

export type McpAccessEnv = {
  TEAM_DOMAIN?: string;
  MCP_HOSTNAME?: string;
  MCP_POLICY_AUD?: string;
  MCP_SERVICE_CLIENT_ID?: string;
};

export type McpAccessConfig = {
  issuer: string;
  audience: string;
  hostname: string;
  serviceClientId: string;
};

const keySets = new Map<string, JWTVerifyGetKey>();

function trimmed(value: string | undefined): string {
  return value?.trim() ?? "";
}

function jsonError(message: string, status: number): Response {
  return Response.json(
    { error: message },
    { status, headers: { "cache-control": "no-store" } },
  );
}

export function parseMcpHostname(value: string | undefined): string | null {
  const raw = trimmed(value).toLowerCase();
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(raw)) {
    return null;
  }
  if (raw === "localhost" || raw.endsWith(".localhost")) {
    return null;
  }
  return raw;
}

export function parseServiceClientId(value: string | undefined): string | null {
  const raw = trimmed(value);
  if (!/^[a-z0-9](?:[a-z0-9._-]{0,198}[a-z0-9])?$/i.test(raw)) {
    return null;
  }
  if (raw.includes("@")) {
    return null;
  }
  return raw;
}

export function resolveMcpAccess(env: McpAccessEnv): McpAccessConfig | null {
  const issuer = parseIssuer(env.TEAM_DOMAIN);
  const audience = parseAudience(env.MCP_POLICY_AUD);
  const hostname = parseMcpHostname(env.MCP_HOSTNAME);
  const serviceClientId = parseServiceClientId(env.MCP_SERVICE_CLIENT_ID);
  if (!issuer || !audience || !hostname || !serviceClientId) {
    return null;
  }
  return { issuer, audience, hostname, serviceClientId };
}

function browserSent(request: Request): boolean {
  if (request.headers.has("origin")) {
    return true;
  }
  const site = request.headers.get("sec-fetch-site");
  return site !== null && site !== "";
}

function serviceClaimsMatch(payload: JWTPayload, serviceClientId: string): boolean {
  if (payload.type !== "app") {
    return false;
  }
  if (payload.sub !== "") {
    return false;
  }
  if ("email" in payload) {
    return false;
  }
  return payload.common_name === serviceClientId;
}

async function serviceTokenIsValid(
  token: string,
  config: McpAccessConfig,
  keys: JWTVerifyGetKey,
): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ["RS256"],
      clockTolerance: 0,
    });
    return serviceClaimsMatch(payload, config.serviceClientId);
  } catch {
    return false;
  }
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

function createPingServer() {
  const server = new McpServer({
    name: "books-v2",
    version: "0.1.0",
  });
  server.registerTool(
    "ping",
    {
      title: "Connexion",
      description: "Vérifie que le serveur MCP répond. Aucun livre n'est lu.",
    },
    async () => ({
      content: [{ type: "text", text: "pong" }],
    }),
  );
  return server;
}

const mcpHandler = createMcpHandler(createPingServer);

function executionContext(ctx: ExecutionContext | undefined): ExecutionContext {
  if (ctx) {
    return ctx;
  }
  return {
    waitUntil() {},
    passThroughOnException() {},
  } as unknown as ExecutionContext;
}

export async function handleMcpRequest(
  request: Request,
  env: McpAccessEnv,
  ctx?: ExecutionContext,
  keys?: JWTVerifyGetKey,
): Promise<Response | null> {
  const url = new URL(request.url);
  const config = resolveMcpAccess(env);
  const mcpPath = url.pathname === "/mcp";
  const host = url.hostname.toLowerCase();

  if (!config) {
    if (!mcpPath) {
      return null;
    }
    return jsonError("L'accès n'est pas configuré.", 401);
  }

  if (host !== config.hostname) {
    if (!mcpPath) {
      return null;
    }
    return jsonError("Cette adresse n'existe pas.", 404);
  }

  if (!mcpPath) {
    return jsonError("Cette adresse n'existe pas.", 404);
  }

  if (browserSent(request)) {
    return jsonError("Accès refusé.", 403);
  }

  if (request.method === "POST") {
    const declared = request.headers.get("content-length");
    if (declared === null || !/^\d+$/.test(declared)) {
      return jsonError("La taille du message doit être annoncée.", 400);
    }
    if (Number(declared) > MCP_MAX_BODY_BYTES) {
      return jsonError("Le message est trop grand.", 413);
    }
  }

  const token = request.headers.get("cf-access-jwt-assertion")?.trim() ?? "";
  if (token === "") {
    return jsonError("Accès refusé.", 401);
  }
  const valid = await serviceTokenIsValid(token, config, keys ?? keysFor(config.issuer));
  if (!valid) {
    return jsonError("Accès refusé.", 401);
  }

  return mcpHandler(request, env, executionContext(ctx));
}
