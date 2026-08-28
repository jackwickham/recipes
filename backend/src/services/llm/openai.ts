import OpenAI from "openai";
import { type LLM, type LLMOptions, type Message, ReasoningLevel } from "./interface.js";

type ContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "auto" };

export class OpenAILLM implements LLM {
  private client: OpenAI;
  private textModel: string;
  private imageModel: string;

  constructor(apiKey: string, textModel: string, imageModel: string) {
    this.client = new OpenAI({ apiKey });
    this.textModel = textModel;
    this.imageModel = imageModel;
  }

  private toDataUrl(imageBase64: string): string {
    if (imageBase64.startsWith("data:")) return imageBase64;
    return `data:image/jpeg;base64,${imageBase64}`;
  }

  private getReasoning(options?: LLMOptions) {
    if (!options?.reasoning) return undefined;

    // GPT-5.6 models accept none/low/medium/high/xhigh/max - there is no
    // "minimal" level, so the lowest interface level maps to "none".
    switch (options.reasoning) {
      case ReasoningLevel.MINIMAL:
        return { effort: "none" as const };
      case ReasoningLevel.LOW:
        return { effort: "low" as const };
      case ReasoningLevel.MEDIUM:
        return { effort: "medium" as const };
      case ReasoningLevel.HIGH:
        return { effort: "high" as const };
    }
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const response = await this.client.responses.create({
      model: this.textModel,
      input: prompt,
      reasoning: this.getReasoning(options),
    });
    return response.output_text ?? "";
  }

  async completeChat(
    systemPrompt: string,
    messages: Message[],
    options?: LLMOptions
  ): Promise<string> {
    const response = await this.client.responses.create({
      model: this.textModel,
      instructions: systemPrompt,
      input: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      reasoning: this.getReasoning(options),
    });
    return response.output_text ?? "";
  }

  async completeWithImage(
    prompt: string,
    imageBase64: string,
    options?: LLMOptions
  ): Promise<string> {
    return this.completeWithImages(prompt, [imageBase64], options);
  }

  async completeWithImages(
    prompt: string,
    imagesBase64: string[],
    options?: LLMOptions
  ): Promise<string> {
    const content: ContentPart[] = [{ type: "input_text", text: prompt }];

    for (const imageBase64 of imagesBase64) {
      content.push({
        type: "input_image",
        image_url: this.toDataUrl(imageBase64),
        detail: "auto",
      });
    }

    const response = await this.client.responses.create({
      model: this.imageModel,
      input: [{ role: "user", content }],
      reasoning: this.getReasoning(options),
    });

    return response.output_text ?? "";
  }
}
