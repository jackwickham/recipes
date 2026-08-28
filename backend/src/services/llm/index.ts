import type { LLM } from "./interface.js";
import { GoogleLLM } from "./google.js";
import { OpenAILLM } from "./openai.js";
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
    } else if (config.llm.provider === "openai") {
      const apiKey = secrets.openai?.apiKey;
      if (!apiKey) {
        throw new Error(
          "OpenAI API key not found. Set it in your secrets file."
        );
      }
      llmInstance = new OpenAILLM(
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
