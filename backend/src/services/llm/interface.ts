export interface LLM {
  complete(prompt: string): Promise<string>;
  completeWithImage(prompt: string, imageBase64: string): Promise<string>;
}
