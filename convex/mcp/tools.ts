import { SCHEMA_VERSION, EDGE_TYPES } from "../../taxonomy/index";

type ToolAnnotations = {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

type JSONSchemaType = Record<string, unknown>;

type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: JSONSchemaType;
  annotations?: ToolAnnotations;
};

// ─── Shared sub-schemas ───────────────────────────────────────────────────────

const taxonomyPathSchema: JSONSchemaType = {
  type: "string",
  pattern: "^[a-z0-9-]+\\|[a-z0-9-]+\\|[a-z0-9-]+$",
  description:
    "A three-level taxonomy path in L1|L2|L3 format. " +
    "e.g. 'data|read|paginated', 'ui|form|submission', 'auth|guard|query'. " +
    "Use paths from the current taxonomy, but novel paths are accepted — " +
    "they will be reviewed for inclusion in future schema versions.",
};

const edgeSchema: JSONSchemaType = {
  type: "object",
  properties: {
    from: { ...taxonomyPathSchema, description: "Source taxonomy path" },
    to: { ...taxonomyPathSchema, description: "Target taxonomy path" },
    edgeType: {
      type: "string",
      enum: EDGE_TYPES,
      description:
        "The semantic relationship between the two paths. " +
        "submit_handler: form → write. " +
        "data_binding: component ← read. " +
        "optimistic_binding: optimistic state ↔ mutation. " +
        "schema_backing: read/write → schema definition. " +
        "auth_guard: route/query/mutation → auth check. " +
        "identity_propagation: auth provider → downstream context. " +
        "revalidate_after: write → cache invalidation. " +
        "webhook_sync: inbound webhook → local write. " +
        "variant_binding: component → styling variant system. " +
        "url_state_sync: URL params ↔ component state. " +
        "error_boundary: error state → UI recovery component. " +
        "loading_state: async op → loading/skeleton UI. " +
        "type_contract: validator/type constrains multiple paths. " +
        "job_trigger: write/event → async background job.",
    },
    context: {
      type: "string",
      description: "Optional note on why this edge exists in this specific solution",
    },
  },
  required: ["from", "to", "edgeType"],
  additionalProperties: false,
};

const stackContextSchema: JSONSchemaType = {
  type: "object",
  properties: {
    framework: {
      type: "string",
      description: "The web framework, e.g. 'nextjs', 'remix', 'sveltekit', 'express', 'fastapi'",
    },
    libraries: {
      type: "array",
      items: { type: "string" },
      description:
        "Key libraries in use, e.g. ['convex', 'shadcn', 'clerk', 'zod', 'prisma', 'react-hook-form']",
    },
    language: {
      type: "string",
      description: "Primary language, e.g. 'typescript', 'python', 'go'",
    },
  },
  required: ["framework", "libraries", "language"],
  additionalProperties: false,
};

// ─── Tool Definitions ─────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "ingest_solution",
    description: `Record a working code solution with its taxonomy labels and architectural edges.

Call this whenever you produce code that solves a user's intent — especially when the
solution involves interesting architectural patterns worth capturing as training data.

**What to label:**
Map the code to one or more taxonomy paths (L1|L2|L3) that describe what architectural
patterns it demonstrates. Multiple paths are expected — a form component that submits to
a mutation and updates optimistically would get at least three paths.

**Paths to use:**
The taxonomy is organized into eight domains:
  - ui         — components, forms, feedback, navigation, layout
  - routing    — segments, layouts, errors, loading, guards
  - data       — schema, reads (basic/filtered/paginated/realtime/search), writes, jobs
  - server     — actions, handlers, middleware
  - auth       — providers, identity, session, guards, webhooks
  - state      — client state, URL state, optimistic state
  - styling    — layout utilities, variants, theming, animation
  - types      — validators, shared types/props

Novel paths in correct L1|L2|L3 format are accepted — they signal taxonomy gaps.

**Edges to resolve:**
For each pair of co-occurring paths that are connected by a meaningful relationship,
record the edge. Don't over-enumerate — only edges that represent real architectural
glue (e.g. a form wired to a mutation via submit_handler) are valuable.

**Confidence:**
Rate your confidence in the taxonomy labeling from 0.0 to 1.0.
1.0 = the paths are unambiguous. 0.5 = the code could reasonably be labeled differently.
Low confidence is still worth recording — it surfaces ambiguous taxonomy boundaries.

Current schema version: ${SCHEMA_VERSION}`,
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          minLength: 1,
          description: "The complete code snippet being labeled",
        },
        intent: {
          type: "string",
          minLength: 1,
          description: "The original natural language input that prompted this code",
        },
        taxonomy_paths: {
          type: "array",
          items: taxonomyPathSchema,
          minItems: 1,
          description: "One or more taxonomy paths this solution demonstrates",
        },
        resolved_edges: {
          type: "array",
          items: edgeSchema,
          description:
            "Typed edges between co-occurring taxonomy paths. " +
            "Empty array is valid when paths are independent.",
        },
        stack_context: {
          ...stackContextSchema,
          description: "The tech stack this solution was written for",
        },
        model: {
          type: "string",
          description:
            "The model ID that generated this code, e.g. 'claude-opus-4-6', 'claude-sonnet-4-6'. " +
            "Used for training weight: Opus > Sonnet > Haiku.",
        },
        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
          description:
            "Your confidence in the taxonomy labeling (0.0–1.0). " +
            "Affects training weight — honest low confidence is more valuable than inflated confidence.",
        },
      },
      required: ["code", "intent", "taxonomy_paths", "resolved_edges", "stack_context", "model"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },

  {
    name: "ingest_correction",
    description: `Record a human correction to a previously ingested solution's taxonomy labels.

Human corrections are the highest-value signal in the training data. They directly
measure intent parsing accuracy — how well the taxonomy labeling reflects what the
code was actually trying to do.

**When to call this:**
- When a user explicitly corrects the taxonomy labeling you applied to a solution
- When you realize after the fact that a prior labeling was wrong
- When a code review reveals the solution was misclassified

**The reason field matters:**
Explain *why* the original labeling was wrong and *why* the corrected paths are right.
This is the signal that teaches the system to distinguish between similar patterns.
e.g. "Original labeled as data|write|basic but this is data|write|transactional —
it inserts into two tables atomically. The multi-table atomic write is the key signal."

**Finding the original solution ID:**
The ULID is returned by ingest_solution. If you don't have it, provide your best
recollection of the original intent — the reason field will carry the correction signal
even if the ULID lookup is approximate.`,
    inputSchema: {
      type: "object",
      properties: {
        original_id: {
          type: "string",
          description: "ULID of the solution being corrected, as returned by ingest_solution",
        },
        corrected_paths: {
          type: "array",
          items: taxonomyPathSchema,
          minItems: 1,
          description: "The corrected taxonomy path set — what the solution should have been labeled as",
        },
        reason: {
          type: "string",
          minLength: 10,
          description:
            "Why the original labeling was wrong and why the corrected paths are right. " +
            "Be specific — this is the signal that trains intent parsing accuracy.",
        },
        corrected_by: {
          type: "string",
          description:
            "Who made the correction. Default: 'human'. " +
            "Use 'human' for user corrections, 'agent' for self-corrections.",
        },
      },
      required: ["original_id", "corrected_paths", "reason"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },

  {
    name: "ingest_negative",
    description: `Record a failed or incorrect code solution as a negative training example.

Negative examples are as valuable as positive ones — they teach the system what NOT to
produce for a given intent + taxonomy path combination.

**When to call this:**
- When code fails to compile or run
- When tests fail on a generated solution
- When a user rejects a solution as the wrong approach
- When you recognize mid-generation that you're going down the wrong path
- When a security flaw or type error is identified after generation

**Failure modes:**
  compilation_error  — code doesn't compile or has syntax errors
  test_failure       — code compiles but tests fail
  wrong_approach     — code works but is the wrong architectural pattern for the intent
  security_flaw      — code has a security vulnerability (XSS, SQL injection, auth bypass, etc.)
  type_error         — TypeScript type errors or runtime type mismatches
  runtime_error      — code throws at runtime outside of tests
  human_rejected     — user explicitly rejected this solution

**Taxonomy paths for negatives:**
Label with the paths the solution was ATTEMPTING to implement, even though it failed.
The combination of (failed paths + failure mode) is the signal — it maps the "wrong
approach" space for a given intent.`,
    inputSchema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          minLength: 1,
          description: "The failed code snippet",
        },
        intent: {
          type: "string",
          minLength: 1,
          description: "The original natural language input that prompted this code",
        },
        taxonomy_paths: {
          type: "array",
          items: taxonomyPathSchema,
          minItems: 1,
          description: "The paths this code was attempting to implement (despite failing)",
        },
        resolved_edges: {
          type: "array",
          items: edgeSchema,
          description: "Edges that were attempted — may be invalid (that's the signal)",
        },
        failure_mode: {
          type: "string",
          enum: [
            "compilation_error",
            "test_failure",
            "wrong_approach",
            "security_flaw",
            "type_error",
            "runtime_error",
            "human_rejected",
          ],
          description: "How/why this solution failed",
        },
        failure_detail: {
          type: "string",
          description:
            "The actual error message, test output, or rejection reason. " +
            "Include compiler errors, stack traces, or user feedback verbatim when available.",
        },
        stack_context: {
          ...stackContextSchema,
          description: "The tech stack this solution was written for",
        },
        model: {
          type: "string",
          description: "The model ID that generated this code",
        },
      },
      required: ["code", "intent", "taxonomy_paths", "failure_mode", "stack_context", "model"],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
];

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((t) => t.name === name);
}
