import { readFileSync, existsSync } from "fs";
import { parse } from "yaml";

export interface Config {
  port: number;
  database: {
    path: string;
  };
  llm: {
    provider: LLMProvider;
    textModel: string;
    imageModel: string;
  };
}

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

const DEFAULT_MODELS: Record<LLMProvider, { textModel: string; imageModel: string }> = {
  google: {
    textModel: "gemini-3-flash-preview",
    imageModel: "gemini-3-pro-image-preview",
  },
  openai: {
    textModel: "gpt-5.6-terra",
    imageModel: "gpt-5.6-terra",
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
        ...DEFAULT_MODELS.google,
      },
    };
  }

  const content = readFileSync(CONFIG_PATH, "utf-8");
  const parsed = parse(content) as Partial<Config>;
  const provider = parsed.llm?.provider ?? "google";

  if (!(provider in DEFAULT_MODELS)) {
    throw new Error(
      `Unknown LLM provider "${provider}". Supported providers: ${Object.keys(DEFAULT_MODELS).join(", ")}`
    );
  }

  return {
    port: parsed.port ?? 3000,
    database: {
      path: process.env.DATABASE_PATH ?? parsed.database?.path ?? "./data/recipes.db",
    },
    llm: {
      provider,
      textModel: parsed.llm?.textModel ?? DEFAULT_MODELS[provider].textModel,
      imageModel: parsed.llm?.imageModel ?? DEFAULT_MODELS[provider].imageModel,
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
