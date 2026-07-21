// client/scripts/dump-content-keys.mjs
// Regenerate go-server/testdata/content_keys.txt from the TS registry.
// Run: node client/scripts/dump-content-keys.mjs
import { CONTENT_REGISTRY } from "../src/content/registry.ts";
import { writeFileSync } from "node:fs";

const keys = CONTENT_REGISTRY.map((f) => f.key).sort();
writeFileSync(
  new URL("../../go-server/testdata/content_keys.txt", import.meta.url),
  keys.join("\n") + "\n"
);
console.log(`wrote ${keys.length} keys`);
