/**
 * Run this script to regenerate nodes.json from the TypeScript taxonomy.
 * Usage: npx tsx taxonomy/generate-json.ts
 */
import { writeFileSync } from "fs";
import { TAXONOMY_NODES, EDGE_TYPES, SCHEMA_VERSION } from "./index.ts";

const output = {
  schemaVersion: SCHEMA_VERSION,
  generatedAt: new Date().toISOString(),
  nodeCount: TAXONOMY_NODES.length,
  edgeTypes: EDGE_TYPES,
  nodes: TAXONOMY_NODES,
};

writeFileSync(
  new URL("./nodes.json", import.meta.url),
  JSON.stringify(output, null, 2),
);

console.log(`Generated nodes.json — ${TAXONOMY_NODES.length} nodes, schema v${SCHEMA_VERSION}`);
