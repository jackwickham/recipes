import type { LLM } from "./interface.js";
import { GoogleLLM } from "./google.js";
import { loadConfig, loadSecrets } from "../config.js";

export type { LLM } from "./interface.js";

let llmInstance: LLM | null = null;

export function getLLM(): LLM {
  if (!llmInstance) {
    const config = loadConfig();
    const secrets = loadSecrets();

    if (config.llm.provider === "google") {
      const apiKey = secrets.google?.apiKey;
      if (!apiKey) {
        throw new Error(
          "Google API key not found. Set it in your secrets file."
        );
      }
      llmInstance = new GoogleLLM(
        apiKey,
        config.llm.textModel,
        config.llm.imageModel
      );
    } else {
      throw new Error(`Unknown LLM provider: ${config.llm.provider}`);
    }
  }

  return llmInstance;
}
