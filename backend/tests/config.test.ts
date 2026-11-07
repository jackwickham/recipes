import { afterEach, describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync } from "fs";
import { loadConfig } from "../src/services/config.js";

vi.mock("fs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("fs")>()),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("database configuration", () => {
  it("honours DATABASE_PATH without a config file", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.stubEnv("DATABASE_PATH", "/tmp/recipes-config-test.db");

    expect(loadConfig().database.path).toBe("/tmp/recipes-config-test.db");
    expect(readFileSync).not.toHaveBeenCalled();
  });

  it("uses the default path without a config file or override", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    vi.stubEnv("DATABASE_PATH", undefined);

    expect(loadConfig().database.path).toBe("./data/recipes.db");
  });

  it("honours DATABASE_PATH ahead of the config file", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("database:\n  path: ./configured.db\n");
    vi.stubEnv("DATABASE_PATH", "/tmp/recipes-config-test.db");

    expect(loadConfig().database.path).toBe("/tmp/recipes-config-test.db");
  });

  it("uses the configured path without an override", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFileSync).mockReturnValue("database:\n  path: ./configured.db\n");
    vi.stubEnv("DATABASE_PATH", undefined);

    expect(loadConfig().database.path).toBe("./configured.db");
  });
});
