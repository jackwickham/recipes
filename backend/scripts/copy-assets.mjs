import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Copy runtime assets into dist alongside the compiled JavaScript.
 *
 * tsc emits only JavaScript, so anything the server reads from disk at runtime has
 * to be brought across separately. Without this, `npm run build && npm run start`
 * dies in getDb() looking for schema.sql, and only the Docker image works - because
 * the Dockerfile used to copy the file in by hand.
 */
const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const ASSETS = ["db/schema.sql"];

for (const asset of ASSETS) {
  const from = join(backendRoot, "src", asset);
  const to = join(backendRoot, "dist", asset);

  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  console.log(`copied ${asset} -> dist/${asset}`);
}
