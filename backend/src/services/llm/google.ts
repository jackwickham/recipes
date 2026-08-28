import { GoogleGenAI, ThinkingLevel, type Content, type Part } from "@google/genai";
import type { TaskModels } from "../config.js";
import {
  BaseLLM,
  ReasoningLevel,
  type LLMRequest,
  type ToolRequest,
  type ToolResponse,
} from "./interface.js";

export class GoogleLLM extends BaseLLM {
  private client: GoogleGenAI;
  private models: TaskModels;

  constructor(apiKey: string, models: TaskModels) {
    super();
    this.client = new GoogleGenAI({ apiKey });
    this.models = models;
  }

  private modelFor(request: LLMRequest): string {
    return this.models[request.task];
  }

  private parseBase64Image(imageBase64: string): {
    mimeType: string;
    data: string;
  } {
    const match = imageBase64.match(/^data:([^;]+);base64,/);
    if (match) {
      return {
        mimeType: match[1],
        data: imageBase64.replace(/^data:[^;]+;base64,/, ""),
      };
    }
    return { mimeType: "image/jpeg", data: imageBase64 };
  }

  /** Images ride along with the final user message. */
  private buildContents(request: LLMRequest): Content[] {
    const contents: Content[] = request.messages.map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }] as Part[],
    }));

    if (request.images?.length) {
      const imageParts: Part[] = request.images.map((image) => ({
        inlineData: this.parseBase64Image(image),
      }));
      const last = contents[contents.length - 1];
      if (last?.role === "user") {
        last.parts = [...(last.parts ?? []), ...imageParts];
      } else {
        contents.push({ role: "user", parts: imageParts });
      }
    }

    return contents;
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

  private baseConfig(model: string, request: LLMRequest) {
    const thinkingLevel = this.getThinkingLevel(model, request.options?.reasoning);
    return {
      ...(request.systemPrompt
        ? { systemInstruction: request.systemPrompt }
        : {}),
      ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
    };
  }

  protected async completeJson(
    request: LLMRequest,
    schema: { name: string; jsonSchema: Record<string, unknown> }
  ): Promise<string> {
    const model = this.modelFor(request);
    const response = await this.client.models.generateContent({
      model,
      contents: this.buildContents(request),
      config: {
        ...this.baseConfig(model, request),
        responseMimeType: "application/json",
        responseJsonSchema: schema.jsonSchema,
      },
    });
    return response.text ?? "";
  }

  async completeWithTools(request: ToolRequest): Promise<ToolResponse> {
    const model = this.modelFor(request);
    const response = await this.client.models.generateContent({
      model,
      contents: this.buildContents(request),
      config: {
        ...this.baseConfig(model, request),
        tools: [
          {
            functionDeclarations: request.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parametersJsonSchema: tool.parameters,
            })),
          },
        ],
      },
    });

    return {
      text: response.text ?? "",
      toolCalls: (response.functionCalls ?? []).map((call) => ({
        name: call.name ?? "",
        arguments: call.args,
      })),
    };
  }
}
