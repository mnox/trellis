import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { handleMcpRequest, corsHeaders } from "./mcp/handler";

const http = httpRouter();

const optionsHandler = httpAction(async () => {
  return new Response(null, { status: 204, headers: corsHeaders() });
});

// ── MCP endpoint ──────────────────────────────────────────────────────────────
http.route({ path: "/mcp", method: "POST", handler: handleMcpRequest });
http.route({ path: "/mcp", method: "GET", handler: handleMcpRequest });
http.route({ path: "/mcp", method: "DELETE", handler: handleMcpRequest });
http.route({ path: "/mcp", method: "OPTIONS", handler: optionsHandler });

export default http;
