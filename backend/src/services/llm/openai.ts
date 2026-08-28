import OpenAI from "openai";
import type { ResponseInput } from "openai/resources/responses/responses";
import {
  BaseLLM,
  ReasoningLevel,
  type LLMRequest,
  type ToolRequest,
  type ToolResponse,
} from "./interface.js";

type ContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "auto" };

export class OpenAILLM extends BaseLLM {
  private client: OpenAI;
  private textModel: string;
  private imageModel: string;

  constructor(apiKey: string, textModel: string, imageModel: string) {
    super();
    this.client = new OpenAI({ apiKey });
    this.textModel = textModel;
    this.imageModel = imageModel;
  }

  private modelFor(request: LLMRequest): string {
    return request.images?.length ? this.imageModel : this.textModel;
  }

  private toDataUrl(imageBase64: string): string {
    if (imageBase64.startsWith("data:")) return imageBase64;
    return `data:image/jpeg;base64,${imageBase64}`;
  }

  /** Images ride along with the final user message. */
  private buildInput(request: LLMRequest): ResponseInput {
    const input: ResponseInput = request.messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    if (request.images?.length) {
      const imageParts: ContentPart[] = request.images.map((image) => ({
        type: "input_image",
        image_url: this.toDataUrl(image),
        detail: "auto",
      }));
      const last = input[input.length - 1];

      if (last && "role" in last && last.role === "user") {
        const existing = typeof last.content === "string" ? last.content : "";
        last.content = [
          { type: "input_text", text: existing } satisfies ContentPart,
          ...imageParts,
        ];
      } else {
        input.push({ role: "user", content: imageParts });
      }
    }

    return input;
  }

  private getReasoning(request: LLMRequest) {
    const reasoning = request.options?.reasoning;
    if (!reasoning) return undefined;

    // GPT-5.6 models accept none/low/medium/high/xhigh/max - there is no
    // "minimal" level, so the lowest interface level maps to "none".
    switch (reasoning) {
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

  protected async completeJson(
    request: LLMRequest,
    schema: { name: string; jsonSchema: Record<string, unknown> }
  ): Promise<string> {
    const response = await this.client.responses.create({
      model: this.modelFor(request),
      instructions: request.systemPrompt,
      input: this.buildInput(request),
      reasoning: this.getReasoning(request),
      text: {
        format: {
          type: "json_schema",
          name: schema.name,
          schema: schema.jsonSchema,
          strict: true,
        },
      },
    });
    return response.output_text ?? "";
  }

  async completeWithTools(request: ToolRequest): Promise<ToolResponse> {
    const response = await this.client.responses.create({
      model: this.modelFor(request),
      instructions: request.systemPrompt,
      input: this.buildInput(request),
      reasoning: this.getReasoning(request),
      tools: request.tools.map((tool) => ({
        type: "function" as const,
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
        strict: true,
      })),
    });

    const toolCalls = response.output
      .filter((item) => item.type === "function_call")
      .map((call) => ({
        name: call.name,
        arguments: safeJsonParse(call.arguments),
      }));

    return { text: response.output_text ?? "", toolCalls };
  }
}

/** Tool arguments arrive as a JSON string; an unparseable one is left for schema validation to reject. */
function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
