import { readFileSync, existsSync } from "fs";
import { parse } from "yaml";
import type { LLMTask } from "./llm/interface.js";

export interface Config {
  port: number;
  database: {
    path: string;
  };
  llm: {
    provider: LLMProvider;
    models: TaskModels;
  };
}

/** One model per {@link LLMTask}. */
export type TaskModels = Record<LLMTask, string>;

export type LLMProvider = "google" | "openai";

export interface Secrets {
  google?: {
    apiKey: string;
  };
  openai?: {
    apiKey: string;
  };
}

const CONFIG_PATH = "./config.yml";

/** Cheap-but-capable models by default; point `chat` at a stronger one in config.yml. */
const DEFAULT_MODELS: Record<LLMProvider, TaskModels> = {
  google: {
    import: "gemini-3-flash-preview",
    chat: "gemini-3-flash-preview",
  },
  openai: {
    import: "gpt-5.6-terra",
    chat: "gpt-5.6-terra",
  },
};

export function loadConfig(): Config {
  if (!existsSync(CONFIG_PATH)) {
    // Return defaults if no config file exists
    return {
      port: 3000,
      database: {
        path: "./data/recipes.db",
      },
      llm: {
        provider: "google",
        models: DEFAULT_MODELS.google,
      },
    };
  }

  const content = readFileSync(CONFIG_PATH, "utf-8");
  const parsed = parse(content) as {
    port?: number;
    database?: { path?: string };
    llm?: { provider?: LLMProvider; models?: Partial<TaskModels> };
  };
  const provider = parsed.llm?.provider ?? "google";

  if (!(provider in DEFAULT_MODELS)) {
    throw new Error(
      `Unknown LLM provider "${provider}". Supported providers: ${Object.keys(DEFAULT_MODELS).join(", ")}`,
    );
  }

  return {
    port: parsed.port ?? 3000,
    database: {
      path:
        process.env.DATABASE_PATH ??
        parsed.database?.path ??
        "./data/recipes.db",
    },
    llm: {
      provider,
      models: {
        import: parsed.llm?.models?.import ?? DEFAULT_MODELS[provider].import,
        chat: parsed.llm?.models?.chat ?? DEFAULT_MODELS[provider].chat,
      },
    },
  };
}

export function loadSecrets(): Secrets {
  const secretsPath = process.env.SECRETS_FILE || "./secrets.yml";

  if (!existsSync(secretsPath)) {
    console.warn(`Secrets file not found at ${secretsPath}`);
    return {};
  }

  const content = readFileSync(secretsPath, "utf-8");
  return parse(content) as Secrets;
}
