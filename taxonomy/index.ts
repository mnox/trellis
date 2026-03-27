/**
 * Trellis Taxonomy — v1.0.0 (LORE: Labeled Observation and Retrieval Engine)
 *
 * Generic, stack-agnostic taxonomy for architectural intent classification.
 * Paths are three levels deep: L1|L2|L3
 *
 * L1 = Architectural domain (what layer/concern)
 * L2 = Concern within that domain
 * L3 = Behavioral specificity (what pattern)
 *
 * Stack-specific details live on the ingested solution (stackContext field),
 * not in the taxonomy. This keeps the taxonomy dense with training data
 * across all stacks while preserving stack-filtered retrieval at inference time.
 */

export const SCHEMA_VERSION = "1.0.0";

// ─── Core Types ───────────────────────────────────────────────────────────────

export type TaxonomyPath = string; // "L1|L2|L3"

export type TaxonomyNode = {
  /** The full path string, e.g. "data|read|paginated" */
  path: TaxonomyPath;
  /** LLM-legible description of what this node represents.
   *  Written as prompting context for the labeling agent, not machine logic. */
  description: string;
  /** 2–3 one-liners of what this looks like in practice, stack-agnostic */
  examples: string[];
};

/**
 * Typed edge between two taxonomy paths.
 * Edges encode the "glue" — the relationship between two co-occurring patterns.
 * An LLM agent resolves which edges apply when multiple paths are emitted together.
 */
export type Edge = {
  from: TaxonomyPath;
  to: TaxonomyPath;
  edgeType: EdgeType;
  /** Optional human-readable note on why this edge exists in this solution */
  context?: string;
};

export type EdgeType =
  | "submit_handler"       // form submission wired to a write operation
  | "data_binding"         // component reads from a query/reactive source
  | "optimistic_binding"   // optimistic UI state tied to a pending write
  | "schema_backing"       // a write/read operation is backed by a schema definition
  | "auth_guard"           // a route, query, or mutation enforces an auth check
  | "identity_propagation" // auth identity flows into a downstream operation
  | "revalidate_after"     // a write triggers cache/data invalidation
  | "webhook_sync"         // inbound webhook triggers a local write
  | "variant_binding"      // a component's appearance is driven by a variant system
  | "url_state_sync"       // component state is encoded in / driven by URL params
  | "error_boundary"       // an error state is caught and displayed via a UI boundary
  | "loading_state"        // a loading/suspense state is wired to an async operation
  | "type_contract"        // a shared type or validator constrains multiple paths
  | "job_trigger";         // a write or event triggers an async job

/**
 * Stack context attached to every ingested solution.
 * Lives on the solution record, not in the taxonomy path.
 */
export type StackContext = {
  framework: string;    // e.g. "nextjs", "remix", "sveltekit", "express"
  libraries: string[];  // e.g. ["convex", "shadcn", "clerk", "zod", "prisma"]
  language: string;     // e.g. "typescript", "python", "go"
};

// ─── Taxonomy Nodes ───────────────────────────────────────────────────────────

export const TAXONOMY_NODES: TaxonomyNode[] = [

  // ── UI ──────────────────────────────────────────────────────────────────────

  {
    path: "ui|component|primitive",
    description:
      "An atomic, unstyled or minimally styled UI element with no internal composition. " +
      "It accepts props and renders a single visual unit. Not assembled from other components.",
    examples: [
      "A Button component wrapping a <button> with variant props",
      "An Input component with forwarded ref and size variants",
      "A Badge component rendering a <span> with status color logic",
    ],
  },
  {
    path: "ui|component|composition",
    description:
      "A component assembled from two or more primitives or other compositions. " +
      "Encodes a reusable UI pattern that combines layout, primitives, and local state.",
    examples: [
      "A UserCard assembling Avatar, Badge, and Button primitives",
      "A DataTable wrapping a table primitive with sorting and pagination controls",
      "A CommandPalette combining a Dialog, Input, and virtualized List",
    ],
  },
  {
    path: "ui|form|schema",
    description:
      "The validation schema definition for a form — field shapes, constraints, and error messages. " +
      "Decoupled from rendering. Typically defined with a schema library (zod, yup, valibot, etc.).",
    examples: [
      "A zod schema defining required fields, email format, and min-length on a signup form",
      "A yup object schema with conditional required fields based on a role selector",
      "A valibot schema with custom refinement for password confirmation matching",
    ],
  },
  {
    path: "ui|form|fields",
    description:
      "Wiring controlled form fields to a form state manager. " +
      "Covers registration, ref forwarding, change handling, and touched/dirty tracking.",
    examples: [
      "react-hook-form register() calls wiring Input components to form state",
      "Controlled <select> with onChange wired to formik setFieldValue",
      "A custom field component accepting field/meta props from a form library",
    ],
  },
  {
    path: "ui|form|submission",
    description:
      "The submission handler: collecting validated form values and dispatching a write operation. " +
      "Includes loading state during submission, success handling, and error display.",
    examples: [
      "onSubmit calling a mutation with form values, setting isSubmitting, catching errors",
      "A form action (server action) triggered on submit with pending state via useFormStatus",
      "handleSubmit wrapping a createUser mutation with optimistic navigation on success",
    ],
  },
  {
    path: "ui|feedback|toast",
    description:
      "Transient, non-blocking notification displayed to the user after an event. " +
      "Auto-dismisses. Does not require user action.",
    examples: [
      "A success toast shown after a record is saved",
      "An error toast with retry action on a failed network request",
      "A warning toast for a background sync conflict",
    ],
  },
  {
    path: "ui|feedback|modal",
    description:
      "An interrupting overlay that blocks interaction with the page until dismissed. " +
      "Requires an explicit user action to close. Used for confirmations, detail views, or forms.",
    examples: [
      "A confirmation dialog before deleting a record",
      "A Sheet sliding in from the right for an edit form",
      "A full-screen modal for a multi-step wizard",
    ],
  },
  {
    path: "ui|feedback|inline",
    description:
      "Feedback rendered inline within the page layout — not overlaid. " +
      "Covers empty states, inline validation errors, skeleton placeholders, and status indicators.",
    examples: [
      "An empty state illustration shown when a list has no items",
      "A field-level error message below an invalid input",
      "A skeleton loader replacing a card while data loads",
    ],
  },
  {
    path: "ui|navigation|menu",
    description:
      "Navigation UI for moving between top-level sections of an application. " +
      "Covers sidebars, nav bars, dropdown menus, and mobile nav drawers.",
    examples: [
      "A sidebar nav with active route highlighting via router state",
      "A top navbar with dropdown menus for nested sections",
      "A command palette with fuzzy-search navigation",
    ],
  },
  {
    path: "ui|navigation|breadcrumb",
    description:
      "Contextual location indicator showing the user's position in a hierarchy. " +
      "Derived from route params or explicit prop passing.",
    examples: [
      "A breadcrumb built from dynamic route segments and entity names",
      "A breadcrumb with truncation for deep hierarchies",
    ],
  },
  {
    path: "ui|data-display|table",
    description:
      "Tabular data rendering with optional sorting, filtering, and pagination. " +
      "May include row selection, expandable rows, or inline editing.",
    examples: [
      "A sortable table with column definitions and server-side pagination",
      "A data grid with inline cell editing and row selection checkboxes",
      "A responsive table that collapses to a card layout on mobile",
    ],
  },
  {
    path: "ui|data-display|list",
    description:
      "An ordered or unordered list of items, potentially virtualized or infinite-scrolling. " +
      "Distinct from tables — no columnar structure.",
    examples: [
      "A virtualized list of 10,000 log entries",
      "An infinite-scroll feed loading more items on scroll",
      "A drag-and-drop ordered list with position persistence",
    ],
  },
  {
    path: "ui|layout|page",
    description:
      "Top-level page structure: the outer shell that wraps all content for a route. " +
      "Typically includes header, main content area, and optionally sidebar/footer.",
    examples: [
      "A dashboard page layout with sidebar nav and top header",
      "A full-bleed marketing page with sticky nav",
      "A two-column detail page with a main content area and a right panel",
    ],
  },
  {
    path: "ui|layout|section",
    description:
      "A named sub-region within a page layout. Not a full page — a reusable structural block. " +
      "Provides consistent spacing, max-width, and heading structure.",
    examples: [
      "A feature section with title, description, and CTA on a marketing page",
      "A settings section card with a header and form fields",
      "A stats row section with metric cards across the full width",
    ],
  },

  // ── Routing ─────────────────────────────────────────────────────────────────

  {
    path: "routing|segment|static",
    description:
      "A route definition for a fixed URL path with no dynamic parameters. " +
      "Known at build time; may be statically rendered.",
    examples: [
      "app/dashboard/page.tsx serving /dashboard",
      "A static /about page with no data fetching",
      "A fixed /settings route rendering user preferences",
    ],
  },
  {
    path: "routing|segment|dynamic",
    description:
      "A route with one or more URL parameters resolved at request time. " +
      "Params are extracted from the URL and passed to the page or used for data fetching.",
    examples: [
      "app/posts/[slug]/page.tsx with slug used to fetch post content",
      "A /users/[id]/profile route where id drives the data query",
      "Nested dynamic routes like /orgs/[orgId]/projects/[projectId]",
    ],
  },
  {
    path: "routing|segment|parallel",
    description:
      "Multiple route segments rendered simultaneously in named slots within a shared layout. " +
      "Or a route that intercepts navigation to render content in a modal/overlay without leaving the current page.",
    examples: [
      "@modal and @feed slots rendered in the same layout simultaneously",
      "An intercepted /photos/[id] route rendering a photo in a modal over the feed",
      "Parallel dashboard panels independently loading their own data",
    ],
  },
  {
    path: "routing|layout|root",
    description:
      "The application root layout — wraps every page. " +
      "Responsible for global providers, fonts, metadata, and persistent UI chrome.",
    examples: [
      "app/layout.tsx providing ThemeProvider, AuthProvider, and QueryClient",
      "Root layout injecting analytics scripts and global CSS",
      "A root layout with persistent sidebar and top navigation",
    ],
  },
  {
    path: "routing|layout|nested",
    description:
      "A layout scoped to a route segment, wrapping only its child routes. " +
      "Used for shared UI within a section (e.g., all /settings routes share a settings shell).",
    examples: [
      "app/settings/layout.tsx adding a settings sidebar for all /settings/* routes",
      "app/dashboard/layout.tsx providing a dashboard-specific header",
      "A nested layout wrapping all /admin/* routes with an admin nav",
    ],
  },
  {
    path: "routing|error|boundary",
    description:
      "An error recovery UI that catches errors thrown during rendering or data fetching " +
      "and displays a fallback rather than crashing the page.",
    examples: [
      "error.tsx showing a retry button when a server component throws",
      "A React ErrorBoundary wrapping a widget that may fail independently",
      "global-error.tsx as a last-resort full-page error fallback",
    ],
  },
  {
    path: "routing|error|not-found",
    description:
      "The UI rendered when a requested resource or route does not exist. " +
      "Triggered by notFound() calls or unmatched routes.",
    examples: [
      "not-found.tsx rendering a 404 illustration and back-home link",
      "A dynamic route calling notFound() when a DB lookup returns null",
      "A custom 404 page with search functionality",
    ],
  },
  {
    path: "routing|loading|skeleton",
    description:
      "A placeholder UI shown while an async route segment, component, or data fetch is in flight. " +
      "Uses skeleton shapes or spinner patterns to communicate pending state.",
    examples: [
      "loading.tsx rendering a skeleton card grid while the page data loads",
      "A Suspense boundary with a skeleton fallback wrapping a slow component",
      "A shimmer placeholder replacing a user profile while it streams in",
    ],
  },
  {
    path: "routing|guard|redirect",
    description:
      "Logic that redirects a user to a different route based on a condition. " +
      "Commonly used for auth gates, onboarding flows, and feature flags.",
    examples: [
      "redirect('/login') in a server component when no session is found",
      "Middleware redirecting unauthenticated users away from /dashboard/*",
      "Redirect to /onboarding if user profile is incomplete",
    ],
  },

  // ── Data ────────────────────────────────────────────────────────────────────

  {
    path: "data|schema|table",
    description:
      "Definition of a database table, collection, or model — its fields, types, and constraints. " +
      "The authoritative shape of a persisted entity.",
    examples: [
      "A Convex defineTable() call with field validators",
      "A Prisma model block with field types and relations",
      "A Drizzle schema defining a posts table with columns and defaults",
    ],
  },
  {
    path: "data|schema|index",
    description:
      "Index definitions on a table to enable efficient query patterns. " +
      "Includes single-field, compound, and specialized indexes.",
    examples: [
      ".index('by_user_created', ['userId', 'createdAt']) on a messages table",
      "A Prisma @@index directive for a composite query",
      "A database migration adding a covering index for a hot query path",
    ],
  },
  {
    path: "data|schema|relation",
    description:
      "Definition of a relationship between two entities — foreign keys, reference fields, " +
      "or embedded references. Encodes how entities link to each other.",
    examples: [
      "A userId field on a posts table referencing the users table",
      "A Prisma @relation with onDelete: Cascade",
      "A Convex table storing orgId as a reference to an organizations table",
    ],
  },
  {
    path: "data|read|basic",
    description:
      "A straightforward fetch of one record or a small, unfiltered collection. " +
      "No complex filtering, pagination, or real-time behavior.",
    examples: [
      "ctx.db.get(id) fetching a single record by ID",
      "A getUser query returning a user by their external ID",
      "SELECT * FROM posts WHERE id = $1 for a single post",
    ],
  },
  {
    path: "data|read|filtered",
    description:
      "A query that applies one or more filter conditions to narrow the result set. " +
      "May use indexes, where clauses, or filter chains.",
    examples: [
      ".withIndex('by_status', q => q.eq('status', 'active')) in Convex",
      "Prisma findMany with a where clause on multiple fields",
      "A SQL query with a WHERE clause filtering by userId and date range",
    ],
  },
  {
    path: "data|read|paginated",
    description:
      "A query that returns a subset of results with cursor or offset-based pagination. " +
      "Includes logic for fetching the next page and tracking cursor state.",
    examples: [
      "usePaginatedQuery returning pages of 20 items with a loadMore callback",
      "A Prisma query with cursor-based pagination using take and skip",
      "An infinite scroll query storing the last cursor in component state",
    ],
  },
  {
    path: "data|read|realtime",
    description:
      "A data read that stays live — automatically re-renders when the underlying data changes " +
      "without an explicit refetch. Backed by a subscription or reactive query system.",
    examples: [
      "useQuery in Convex — a live query that re-runs when data changes",
      "A Supabase realtime subscription pushing row changes to the client",
      "An SWR query with WebSocket-based revalidation on server push",
    ],
  },
  {
    path: "data|read|search",
    description:
      "A query driven by a search term — full-text, fuzzy, or vector/semantic search. " +
      "Returns results ranked by relevance rather than strict matching.",
    examples: [
      "A Convex searchIndex query with a full-text search term",
      "A vector similarity search using pgvector and embedding comparison",
      "Elasticsearch query with BM25 scoring across multiple fields",
    ],
  },
  {
    path: "data|write|basic",
    description:
      "A single-record create, update, or delete operation with no special transactional requirements. " +
      "The simplest unit of a write.",
    examples: [
      "ctx.db.insert('users', { name, email }) in a Convex mutation",
      "prisma.post.create({ data: { title, authorId } })",
      "An UPDATE statement setting a single field on a row",
    ],
  },
  {
    path: "data|write|transactional",
    description:
      "A write operation that modifies multiple records atomically — all succeed or all fail together. " +
      "Used when data consistency across entities is required.",
    examples: [
      "A Convex mutation inserting into two tables in a single function call",
      "A Prisma $transaction updating an order and decrementing inventory",
      "A SQL transaction transferring funds between two accounts",
    ],
  },
  {
    path: "data|write|batch",
    description:
      "A write operation processing many records in a single call. " +
      "Not necessarily atomic — optimized for throughput over consistency.",
    examples: [
      "ctx.db.insert() called in a loop within a Convex action",
      "prisma.post.createMany({ data: posts }) for bulk creation",
      "A batch upsert of 1,000 product rows from a CSV import",
    ],
  },
  {
    path: "data|write|optimistic",
    description:
      "A write that immediately updates the UI with the expected result before the server confirms. " +
      "The UI rolls back if the server write fails.",
    examples: [
      "useMutation with optimisticUpdate updating the local query cache",
      "An SWR mutate call updating local data optimistically before revalidation",
      "A todo item appearing immediately in the list before the insert completes",
    ],
  },
  {
    path: "data|job|scheduled",
    description:
      "A background task triggered by a timer or cron schedule rather than a user action. " +
      "Runs asynchronously, often for cleanup, aggregation, or notification delivery.",
    examples: [
      "ctx.scheduler.runAfter(0, internal.emails.sendDigest, {}) in Convex",
      "A cron job aggregating daily metrics into a summary table",
      "A scheduled function purging expired sessions every hour",
    ],
  },
  {
    path: "data|job|event-driven",
    description:
      "A background task triggered by a data change event, message queue, or webhook. " +
      "Responds to something that happened, rather than polling on a schedule.",
    examples: [
      "A function triggered by a new row in a database via a trigger or CDC event",
      "A queue consumer processing image resize jobs after upload",
      "An internal action triggered by a Convex mutation completing",
    ],
  },

  // ── Server ──────────────────────────────────────────────────────────────────

  {
    path: "server|action|mutation",
    description:
      "A server-side function invoked directly by client code to perform a write. " +
      "Runs on the server with full DB access but is called like a function from the client. " +
      "Distinct from a REST endpoint — no manual routing.",
    examples: [
      "A Next.js Server Action called via a form action or useTransition",
      "A tRPC mutation procedure callable from client components",
      "An RPC-style server function invoked from a form onSubmit handler",
    ],
  },
  {
    path: "server|action|revalidation",
    description:
      "Server-side logic that invalidates cached data after a mutation, " +
      "causing dependent pages or queries to re-fetch fresh data.",
    examples: [
      "revalidatePath('/posts') called inside a Server Action after creating a post",
      "revalidateTag('user-profile') after updating user settings",
      "cache.invalidate() in a server function after a write completes",
    ],
  },
  {
    path: "server|handler|rest",
    description:
      "An HTTP route handler responding to standard REST verbs (GET, POST, PATCH, DELETE). " +
      "Has explicit method routing and returns a structured HTTP response.",
    examples: [
      "app/api/users/route.ts with GET listing users and POST creating one",
      "An Express router.get('/items', handler) endpoint",
      "A Fastify route handler returning JSON with status codes",
    ],
  },
  {
    path: "server|handler|webhook",
    description:
      "An HTTP endpoint designed to receive inbound events from an external service. " +
      "Validates the event signature, parses the payload, and triggers internal processing.",
    examples: [
      "A Stripe webhook handler verifying signature and processing payment.succeeded",
      "A Clerk webhook syncing user.created events to a local users table",
      "A GitHub webhook processing push events to trigger CI",
    ],
  },
  {
    path: "server|middleware|auth",
    description:
      "Request-level auth enforcement running before route handlers. " +
      "Validates session/token, attaches identity to the request context, or short-circuits with 401/redirect.",
    examples: [
      "clerkMiddleware() checking session on every /dashboard/* request",
      "A JWT validation middleware attaching decoded claims to req.user",
      "Edge middleware checking a cookie and redirecting to /login if absent",
    ],
  },
  {
    path: "server|middleware|redirect",
    description:
      "Request-level redirect logic that runs before serving the route. " +
      "Based on conditions like locale, A/B test variant, feature flag, or auth state.",
    examples: [
      "Middleware detecting locale from Accept-Language and redirecting to /en/...",
      "A/B middleware routing 50% of traffic to /experiment/* routes",
      "Redirect from legacy /old-path to /new-path at the edge",
    ],
  },
  {
    path: "server|middleware|transform",
    description:
      "Middleware that modifies the request or response without redirecting or blocking. " +
      "Adds headers, rewrites URLs, injects context, or transforms response bodies.",
    examples: [
      "Middleware adding security headers (CSP, HSTS) to every response",
      "URL rewriting to proxy /api/v1/* to an internal service",
      "Injecting a request ID header for distributed tracing",
    ],
  },

  // ── Auth ────────────────────────────────────────────────────────────────────

  {
    path: "auth|provider|setup",
    description:
      "Initializing and configuring an auth provider in the application. " +
      "Covers provider wrapping, context injection, and SDK configuration.",
    examples: [
      "<ClerkProvider> wrapping the root layout with publishable key",
      "NextAuth.js options object configuring providers and session strategy",
      "ConvexProviderWithClerk threading Clerk auth into Convex queries",
    ],
  },
  {
    path: "auth|identity|propagation",
    description:
      "Passing the authenticated user's identity into downstream operations — " +
      "queries, mutations, or service calls — so they can make access decisions.",
    examples: [
      "ctx.auth.getUserIdentity() inside a Convex query to filter by userId",
      "req.user.id passed to a service layer for row-level scoping",
      "getServerSession() result passed as a param to a data fetcher",
    ],
  },
  {
    path: "auth|session|read",
    description:
      "Reading the current user's session or identity in a component or route. " +
      "Used to personalize UI, gate features, or display user info.",
    examples: [
      "useUser() returning the current Clerk user in a client component",
      "auth() in a Next.js Server Component returning userId and sessionId",
      "getServerSession() in getServerSideProps for per-request session access",
    ],
  },
  {
    path: "auth|guard|page",
    description:
      "Protecting a page or route — ensuring only authenticated (or authorized) users can access it. " +
      "Unauthenticated users are redirected or shown an error.",
    examples: [
      "A server component calling redirect('/login') if auth() returns null",
      "A higher-order component wrapping a page in a requireAuth check",
      "Route middleware blocking /admin/* for non-admin roles",
    ],
  },
  {
    path: "auth|guard|query",
    description:
      "Auth enforcement inside a data query — ensuring the query only returns data " +
      "the requesting user is permitted to see.",
    examples: [
      "ctx.auth.getUserIdentity() called at the top of a Convex query with a throw if null",
      "A Prisma query scoped to where: { userId: session.user.id }",
      "Row-level security enforced by a policy function before returning results",
    ],
  },
  {
    path: "auth|guard|mutation",
    description:
      "Auth enforcement inside a write operation — ensuring only authorized users " +
      "can perform the mutation.",
    examples: [
      "ctx.auth.getUserIdentity() checked at the start of a Convex mutation",
      "Throwing ConvexError('Unauthorized') if the caller's role doesn't match",
      "A tRPC middleware validating session before the mutation procedure runs",
    ],
  },
  {
    path: "auth|webhook|sync",
    description:
      "Syncing auth provider events (user created, updated, deleted) into the application's " +
      "own database. Keeps local user records in sync with the auth source of truth.",
    examples: [
      "A Clerk webhook handler upserting a users table row on user.created",
      "An Auth0 post-registration action creating a profile record",
      "A webhook consumer syncing team membership changes from an IdP",
    ],
  },

  // ── State ───────────────────────────────────────────────────────────────────

  {
    path: "state|client|local",
    description:
      "State scoped to a single component instance — no sharing across the tree. " +
      "Reset when the component unmounts.",
    examples: [
      "useState for a modal open/closed toggle",
      "useReducer managing a multi-step form's current step",
      "A ref tracking a previous value for comparison",
    ],
  },
  {
    path: "state|client|context",
    description:
      "Shared client state distributed across a component subtree via context or a store. " +
      "Any descendant can read or update this state without prop drilling.",
    examples: [
      "A React context providing theme and setTheme to all descendants",
      "A Zustand store holding sidebar collapsed state consumed across the layout",
      "A Jotai atom shared between sibling components",
    ],
  },
  {
    path: "state|url|search-params",
    description:
      "Application state encoded in URL query parameters. " +
      "Survives navigation, is shareable via URL, and can be bookmarked.",
    examples: [
      "useSearchParams() reading ?tab=billing and ?page=2 from the URL",
      "nuqs useQueryState managing a filters object in the URL",
      "A sort direction and column stored as ?sort=name&order=asc",
    ],
  },
  {
    path: "state|url|router",
    description:
      "Programmatic navigation — pushing a route, replacing history, or prefetching. " +
      "Distinct from declarative Link components.",
    examples: [
      "router.push('/dashboard') after a successful login",
      "router.replace('/onboarding/step-2') advancing through a wizard",
      "router.prefetch('/heavy-page') on hover to reduce perceived latency",
    ],
  },
  {
    path: "state|optimistic|update",
    description:
      "Pre-commit UI state: the UI reflects the expected result of a pending write " +
      "before the server confirms it. Provides instant feedback.",
    examples: [
      "optimisticUpdate adding a todo to the local list before the insert completes",
      "A like button toggling immediately, with the server write in-flight",
      "An SWR mutate call updating local cache before revalidation",
    ],
  },
  {
    path: "state|optimistic|rollback",
    description:
      "Recovery logic when an optimistic write fails. " +
      "The UI reverts to the pre-optimistic state and surfaces an error.",
    examples: [
      "onError handler in a mutation resetting the optimistic update",
      "SWR rollback using previousData on a failed mutate call",
      "Reverting a drag-and-drop reorder when the position save fails",
    ],
  },

  // ── Styling ─────────────────────────────────────────────────────────────────

  {
    path: "styling|layout|utility",
    description:
      "Layout and spacing expressed through utility classes — flex, grid, padding, margin, gap. " +
      "No custom CSS; entirely composition of utility primitives.",
    examples: [
      "flex items-center justify-between gap-4 on a card header",
      "grid grid-cols-3 gap-6 for a feature grid",
      "p-4 md:p-8 for responsive padding",
    ],
  },
  {
    path: "styling|layout|responsive",
    description:
      "Styles that change behavior at different viewport widths via breakpoint variants. " +
      "The component looks or behaves differently on mobile vs. desktop.",
    examples: [
      "hidden md:flex for an element visible only on desktop",
      "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 for a responsive grid",
      "A sidebar that collapses to a drawer on mobile",
    ],
  },
  {
    path: "styling|variant|component",
    description:
      "A variant definition system for a component — mapping named variants to class sets. " +
      "Encodes all visual states (size, color, shape) as named options.",
    examples: [
      "cva() defining size: { sm, md, lg } and intent: { primary, danger } variants",
      "A styled-components variant map for a Button's appearance prop",
      "An oclif or clsx variant object for a Badge's status prop",
    ],
  },
  {
    path: "styling|variant|conditional",
    description:
      "Runtime class merging — combining a base class set with conditionally applied classes. " +
      "Produces a final className string based on props or state.",
    examples: [
      "cn('base-class', isActive && 'text-primary', isDisabled && 'opacity-50')",
      "clsx([styles.button, { [styles.active]: active }])",
      "A template literal conditionally inserting classes based on props",
    ],
  },
  {
    path: "styling|theme|tokens",
    description:
      "Design token overrides — customizing the base visual system's color, spacing, radius, " +
      "or typography values. Applied globally or per-component.",
    examples: [
      "CSS variable overrides in :root {} for shadcn/ui color tokens",
      "tailwind.config.ts extending the default theme with brand colors",
      "A @theme block in a CSS file overriding Tailwind v4 defaults",
    ],
  },
  {
    path: "styling|theme|dark-mode",
    description:
      "Styles and logic for color scheme switching between light and dark modes. " +
      "Includes detection, persistence, and conditional class application.",
    examples: [
      "dark: variant classes applied alongside light defaults",
      "A ThemeProvider toggling a .dark class on <html>",
      "next-themes useTheme returning system/light/dark and a setTheme handler",
    ],
  },
  {
    path: "styling|animation|css",
    description:
      "Animations and transitions defined via CSS classes — keyframes, transition utilities, " +
      "or animation utilities. No JavaScript orchestration.",
    examples: [
      "transition-colors duration-200 on a button hover",
      "animate-spin on a loading spinner",
      "A custom @keyframes fadeIn used via an animate-fade-in utility class",
    ],
  },
  {
    path: "styling|animation|js",
    description:
      "JavaScript-driven animation — using a motion library to animate layout, presence, " +
      "or values imperatively or declaratively.",
    examples: [
      "motion.div with layout and exit animations for list item reorder/removal",
      "useSpring animating a counter value from 0 to N",
      "AnimatePresence wrapping a conditional element for mount/unmount transitions",
    ],
  },

  // ── Types ───────────────────────────────────────────────────────────────────

  {
    path: "types|validator|form",
    description:
      "A runtime validation schema for form input. Defines the expected shape, types, " +
      "constraints, and error messages for user-submitted data.",
    examples: [
      "z.object({ email: z.string().email(), password: z.string().min(8) })",
      "yup.object().shape({ name: yup.string().required() })",
      "valibot object() with pipe() for custom validation logic",
    ],
  },
  {
    path: "types|validator|api",
    description:
      "A runtime validation schema for API inputs or outputs — request bodies, " +
      "query params, or response shapes. Guards the API boundary.",
    examples: [
      "z.object() parsed with safeParse on an incoming API request body",
      "A tRPC input validator on a procedure definition",
      "Convex v.object() defining the argument shape for a query or mutation",
    ],
  },
  {
    path: "types|shared|dto",
    description:
      "A TypeScript type or interface representing a data shape passed across a boundary — " +
      "between server and client, between services, or between layers.",
    examples: [
      "type UserDTO = { id: string; name: string; email: string } used in both API and UI",
      "An inferred type from a zod schema used as the shared contract",
      "A Convex Doc<'users'> type used in both query return and client consumption",
    ],
  },
  {
    path: "types|shared|props",
    description:
      "TypeScript interface or type defining a component's public API — its accepted props. " +
      "Distinct from internal state types.",
    examples: [
      "interface ButtonProps { variant: 'primary' | 'ghost'; onClick: () => void }",
      "type CardProps = React.ComponentPropsWithoutRef<'div'> & { title: string }",
      "A discriminated union prop type for a polymorphic component",
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** All valid taxonomy path strings, derived from TAXONOMY_NODES */
export const VALID_PATHS = new Set(TAXONOMY_NODES.map((n) => n.path));

/** Look up a node by its path string */
export function getNode(path: TaxonomyPath): TaxonomyNode | undefined {
  return TAXONOMY_NODES.find((n) => n.path === path);
}

/** Return all nodes at a given L1 domain */
export function getNodesByDomain(l1: string): TaxonomyNode[] {
  return TAXONOMY_NODES.filter((n) => n.path.startsWith(`${l1}|`));
}

/**
 * Validate a path string format (L1|L2|L3).
 * Returns true for correctly formatted paths even if not in the current node list —
 * agents may emit novel paths that get added in future schema versions.
 */
export function isValidPathFormat(path: string): boolean {
  const parts = path.split("|");
  return parts.length === 3 && parts.every((p) => p.length > 0 && /^[a-z0-9-]+$/.test(p));
}

/** All defined EdgeTypes as a const array (useful for JSON schema enum generation) */
export const EDGE_TYPES: EdgeType[] = [
  "submit_handler",
  "data_binding",
  "optimistic_binding",
  "schema_backing",
  "auth_guard",
  "identity_propagation",
  "revalidate_after",
  "webhook_sync",
  "variant_binding",
  "url_state_sync",
  "error_boundary",
  "loading_state",
  "type_contract",
  "job_trigger",
];
