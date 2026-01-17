import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { type LLM, type LLMOptions, type Message, ReasoningLevel } from "./interface.js";

export class GoogleLLM implements LLM {
  private client: GoogleGenAI;
  private textModel: string;
  private imageModel: string;

  constructor(apiKey: string, textModel: string, imageModel: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.textModel = textModel;
    this.imageModel = imageModel;
  }

  private parseBase64Image(imageBase64: string): {
    mimeType: string;
    data: string;
  } {
    let mimeType = "image/jpeg";
    let data = imageBase64;

    if (imageBase64.startsWith("data:")) {
      const match = imageBase64.match(/^data:([^;]+);base64,/);
      if (match) {
        mimeType = match[1];
        data = imageBase64.replace(/^data:[^;]+;base64,/, "");
      }
    }

    return { mimeType, data };
  }

  private getThinkingLevel(
    model: string,
    reasoning?: ReasoningLevel
  ): ThinkingLevel | undefined {
    if (!reasoning) return undefined;

    const isFlash = model.toLowerCase().includes("flash");

    if (isFlash) {
      // Flash models support all levels
      switch (reasoning) {
        case ReasoningLevel.MINIMAL:
          return ThinkingLevel.MINIMAL;
        case ReasoningLevel.LOW:
          return ThinkingLevel.LOW;
        case ReasoningLevel.MEDIUM:
          return ThinkingLevel.MEDIUM;
        case ReasoningLevel.HIGH:
          return ThinkingLevel.HIGH;
      }
    } else {
      // Pro models only support LOW and HIGH
      switch (reasoning) {
        case ReasoningLevel.MINIMAL:
        case ReasoningLevel.LOW:
          return ThinkingLevel.LOW;
        case ReasoningLevel.MEDIUM:
        case ReasoningLevel.HIGH:
          return ThinkingLevel.HIGH;
      }
    }
  }

  private getConfig(model: string, options?: LLMOptions) {
    const thinkingLevel = this.getThinkingLevel(model, options?.reasoning);
    if (!thinkingLevel) return undefined;

    return {
      thinkingConfig: {
        thinkingLevel,
      },
    };
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const response = await this.client.models.generateContent({
      model: this.textModel,
      contents: prompt,
      config: this.getConfig(this.textModel, options),
    });
    return response.text ?? "";
  }

  async completeChat(
    systemPrompt: string,
    messages: Message[],
    options?: LLMOptions
  ): Promise<string> {
    const contents = messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const response = await this.client.models.generateContent({
      model: this.textModel,
      contents,
      config: {
        ...this.getConfig(this.textModel, options),
        systemInstruction: systemPrompt,
      },
    });
    return response.text ?? "";
  }

  async completeWithImage(
    prompt: string,
    imageBase64: string,
    options?: LLMOptions
  ): Promise<string> {
    const { mimeType, data } = this.parseBase64Image(imageBase64);

    const response = await this.client.models.generateContent({
      model: this.imageModel,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }, { inlineData: { mimeType, data } }],
        },
      ],
      config: this.getConfig(this.imageModel, options),
    });

    return response.text ?? "";
  }

  async completeWithImages(
    prompt: string,
    imagesBase64: string[],
    options?: LLMOptions
  ): Promise<string> {
    const parts: Array<
      { text: string } | { inlineData: { mimeType: string; data: string } }
    > = [{ text: prompt }];

    for (const imageBase64 of imagesBase64) {
      const { mimeType, data } = this.parseBase64Image(imageBase64);
      parts.push({ inlineData: { mimeType, data } });
    }

    const response = await this.client.models.generateContent({
      model: this.imageModel,
      contents: [{ role: "user", parts }],
      config: this.getConfig(this.imageModel, options),
    });

    return response.text ?? "";
  }
}
