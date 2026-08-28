import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll } from "vitest";

/**
 * Point each test worker at its own throwaway database and a secrets file that
 * does not exist. Tests must never touch the developer's real recipes, and a
 * missing API key means an accidental live provider call fails loudly instead of
 * quietly costing money - anything needing an LLM injects one with `setLLM`.
 *
 * This runs before the test file imports `app`, which is what reads the config.
 */
const workerDir = mkdtempSync(join(tmpdir(), "recipes-test-"));

process.env.DATABASE_PATH = join(workerDir, "recipes.db");
process.env.SECRETS_FILE = join(workerDir, "no-secrets.yml");

afterAll(() => {
  rmSync(workerDir, { recursive: true, force: true });
});
