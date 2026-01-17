export enum ReasoningLevel {
  MINIMAL = "minimal",
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
}

export interface LLMOptions {
  reasoning?: ReasoningLevel;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export interface LLM {
  complete(prompt: string, options?: LLMOptions): Promise<string>;
  completeChat(
    systemPrompt: string,
    messages: Message[],
    options?: LLMOptions
  ): Promise<string>;
  completeWithImage(prompt: string, imageBase64: string, options?: LLMOptions): Promise<string>;
  completeWithImages(prompt: string, imagesBase64: string[], options?: LLMOptions): Promise<string>;
}
