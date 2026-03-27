# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

[Unreleased]: https://github.com/mnox/trellis/compare/v0.1.0...HEAD

## [0.1.1] — Unreleased

### Added
- Generic graph layer (schema v1.1.0): `nodes`, `node_edges`, and `record_nodes` tables for dynamic risk profiling, pattern tracking, and facets
- `nodes` — generic node store keyed by slug. Type is an open string (`risk`, `pattern`, `facet`, or anything). New node types require zero schema changes.
- `node_edges` — typed topology edges between nodes (e.g. `prompt-injection --has_facet--> security`). Upserted idempotently.
- `record_nodes` — links solutions and negatives to nodes with edge type and confidence. Duplicate links allowed (frequency is signal).
- `file_paths` field on `solutions` and `negatives` — captures which files a solution touches
- `ingest_solution` and `ingest_negative` MCP tools now accept optional `file_paths`, `nodes`, and `node_edges` args. Nodes are get-or-created inline at ingest time.
- OSS hygiene: LICENSE (MIT), CONTRIBUTING.md, .gitignore, GitHub issue templates

### Fixed
- `noEmit: true` added to `convex/tsconfig.json` — TypeScript was emitting compiled `.js` files alongside sources, causing esbuild collisions on `convex dev`
- `"DOM"` added to `convex/tsconfig.json` lib — `Response` and `console` were unresolved in HTTP action files
- `pnpm.onlyBuiltDependencies` added to `package.json` to unblock esbuild postinstall in pnpm environments
- `convex/_generated/` and `taxonomy/*.js` added to `.gitignore`

[0.1.1]: https://github.com/mnox/trellis/compare/v0.1.0...HEAD
