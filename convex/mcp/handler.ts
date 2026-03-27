import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { TOOL_DEFINITIONS } from "./tools";
import { INSTRUCTIONS } from "./instructions";

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
  };
}

type JsonRpcId = string | number;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
  id?: JsonRpcId;
};

type JsonRpcResult = {
  jsonrpc: "2.0";
  result: unknown;
  id: JsonRpcId | null;
};

type JsonRpcErrorBody = {
  jsonrpc: "2.0";
  error: { code: number; message: string };
  id: JsonRpcId | null;
};

const JSONRPC_PARSE_ERROR = -32700;
const JSONRPC_INVALID_REQUEST = -32600;
const JSONRPC_METHOD_NOT_FOUND = -32601;
const JSONRPC_INVALID_PARAMS = -32602;

// Maps tool names to their internal Convex actions
const TOOL_ACTIONS = {
  ingest_solution: internal.mcp.actions.ingestSolution,
  ingest_correction: internal.mcp.actions.ingestCorrection,
  ingest_negative: internal.mcp.actions.ingestNegative,
  report_taxonomy_gap: internal.mcp.actions.reportTaxonomyGap,
} as const;

type ToolName = keyof typeof TOOL_ACTIONS;

function isValidToolName(name: string): name is ToolName {
  return name in TOOL_ACTIONS;
}

function jsonResponse(body: JsonRpcResult | JsonRpcErrorBody, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function jsonRpcResponse(id: JsonRpcId | null, result: unknown): Response {
  return jsonResponse({ jsonrpc: "2.0", result, id });
}

function jsonRpcError(id: JsonRpcId | null, code: number, message: string, status = 200): Response {
  return jsonResponse({ jsonrpc: "2.0", error: { code, message }, id }, status);
}

function isJsonRpcRequest(body: unknown): body is JsonRpcRequest {
  if (typeof body !== "object" || body === null) return false;
  const obj = body as Record<string, unknown>;
  return (
    obj.jsonrpc === "2.0" &&
    typeof obj.method === "string" &&
    (obj.params === undefined ||
      (typeof obj.params === "object" && obj.params !== null))
  );
}

function isNotification(body: JsonRpcRequest): boolean {
  return !("id" in body) || body.id === undefined;
}

export const handleMcpRequest = httpAction(async (ctx, request) => {
  if (request.method === "GET") {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      {
        status: 405,
        headers: {
          Allow: "POST, DELETE, OPTIONS",
          "Content-Type": "application/json",
          ...corsHeaders(),
        },
      },
    );
  }

  if (request.method === "DELETE") {
    return new Response(null, { status: 202, headers: corsHeaders() });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonRpcError(null, JSONRPC_PARSE_ERROR, "Parse error");
  }

  if (!isJsonRpcRequest(body)) {
    return jsonRpcError(null, JSONRPC_INVALID_REQUEST, "Invalid JSON-RPC 2.0 request");
  }

  if (isNotification(body)) {
    return new Response(null, { status: 202, headers: corsHeaders() });
  }

  const id = body.id ?? null;

  switch (body.method) {
    case "initialize":
      return jsonRpcResponse(id, {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "trellis", version: "0.1.0" },
        instructions: INSTRUCTIONS,
      });

    case "ping":
      return jsonRpcResponse(id, {});

    case "tools/list":
      return jsonRpcResponse(id, { tools: TOOL_DEFINITIONS });

    case "tools/call": {
      const params = body.params;
      if (
        !params ||
        typeof params.name !== "string" ||
        (params.arguments !== undefined &&
          (typeof params.arguments !== "object" || params.arguments === null))
      ) {
        return jsonRpcError(
          id,
          JSONRPC_INVALID_PARAMS,
          "tools/call requires { name: string, arguments?: object }",
        );
      }

      const toolName = params.name;
      if (!isValidToolName(toolName)) {
        return jsonRpcError(id, JSONRPC_METHOD_NOT_FOUND, `Unknown tool: ${toolName}`);
      }

      const args = (params.arguments ?? {}) as Record<string, unknown>;

      try {
        const resultText: string = await ctx.runAction(TOOL_ACTIONS[toolName], args);
        return jsonRpcResponse(id, {
          content: [{ type: "text", text: resultText }],
        });
      } catch (e) {
        console.error(`Tool ${toolName} failed:`, e);
        const message = e instanceof Error ? e.message : "Tool execution failed";
        return jsonRpcResponse(id, {
          content: [{ type: "text", text: `Error: ${message}` }],
          isError: true,
        });
      }
    }

    default:
      return jsonRpcError(id, JSONRPC_METHOD_NOT_FOUND, `Method not found: ${body.method}`);
  }
});
