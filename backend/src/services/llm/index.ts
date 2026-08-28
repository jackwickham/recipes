import type { LLM } from "./interface.js";
import { GoogleLLM } from "./google.js";
import { OpenAILLM } from "./openai.js";
import { loadConfig, loadSecrets } from "../config.js";

export type { LLM } from "./interface.js";

let llmInstance: LLM | null = null;
let override: LLM | null = null;

function createLLM(): LLM {
  const config = loadConfig();
  const secrets = loadSecrets();

  if (config.llm.provider === "google") {
    const apiKey = secrets.google?.apiKey;
    if (!apiKey) {
      throw new Error("Google API key not found. Set it in your secrets file.");
    }
    return new GoogleLLM(apiKey, config.llm.textModel, config.llm.imageModel);
  }

  if (config.llm.provider === "openai") {
    const apiKey = secrets.openai?.apiKey;
    if (!apiKey) {
      throw new Error("OpenAI API key not found. Set it in your secrets file.");
    }
    return new OpenAILLM(apiKey, config.llm.textModel, config.llm.imageModel);
  }

  throw new Error(`Unknown LLM provider: ${config.llm.provider}`);
}

export function getLLM(): LLM {
  if (override) return override;
  if (!llmInstance) {
    llmInstance = createLLM();
  }
  return llmInstance;
}

/**
 * Substitute the LLM used by every service, for tests and local experiments.
 * Pass null to fall back to the configured provider.
 */
export function setLLM(llm: LLM | null): void {
  override = llm;
}
