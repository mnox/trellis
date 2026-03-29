import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { handleMcpRequest, corsHeaders } from "./mcp/handler";

const http = httpRouter();

const optionsHandler = httpAction(async () => {
  return new Response(null, { status: 204, headers: corsHeaders() });
});

// ── OAuth metadata ─────────────────────────────────────────────────────────────
// Tells MCP clients where to find the authorization server (mnox-identity).
const protectedResourceHandler = httpAction(async (_ctx, request) => {
  const url = new URL(request.url);
  const issuer = process.env.IDENTITY_ISSUER!;
  return new Response(
    JSON.stringify({
      resource: `${url.origin}/mcp`,
      authorization_servers: [issuer],
      bearer_methods_supported: ["header"],
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders() } },
  );
});

http.route({
  path: "/.well-known/oauth-protected-resource",
  method: "GET",
  handler: protectedResourceHandler,
});
http.route({
  path: "/.well-known/oauth-protected-resource",
  method: "OPTIONS",
  handler: optionsHandler,
});

// ── MCP endpoint ──────────────────────────────────────────────────────────────
http.route({ path: "/mcp", method: "POST", handler: handleMcpRequest });
http.route({ path: "/mcp", method: "GET", handler: handleMcpRequest });
http.route({ path: "/mcp", method: "DELETE", handler: handleMcpRequest });
http.route({ path: "/mcp", method: "OPTIONS", handler: optionsHandler });

export default http;
