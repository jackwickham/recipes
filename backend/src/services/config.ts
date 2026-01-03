import { readFileSync, existsSync } from "fs";
import { parse } from "yaml";

export interface Config {
  port: number;
  database: {
    path: string;
  };
  llm: {
    provider: "google";
    textModel: string;
    imageModel: string;
  };
}

export interface Secrets {
  google?: {
    apiKey: string;
  };
}

const CONFIG_PATH = "./config.yml";

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
        textModel: "gemini-3-flash-preview",
        imageModel: "gemini-3-pro-image-preview",
      },
    };
  }

  const content = readFileSync(CONFIG_PATH, "utf-8");
  const parsed = parse(content) as Partial<Config>;

  return {
    port: parsed.port ?? 3000,
    database: {
      path: process.env.DATABASE_PATH ?? parsed.database?.path ?? "./data/recipes.db",
    },
    llm: {
      provider: parsed.llm?.provider ?? "google",
      textModel: parsed.llm?.textModel ?? "gemini-3-flash-preview",
      imageModel: parsed.llm?.imageModel ?? "gemini-3-pro-image-preview",
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
