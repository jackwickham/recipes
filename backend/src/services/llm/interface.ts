import type { z } from "zod";
import { toProviderJsonSchema } from "@recipes/shared";

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

/**
 * What a request is for, which picks the configured model. Importing is
 * extraction from a source the user supplied (text, a page or photos); chat
 * covers the conversational assistant and the recipes it writes from scratch or
 * rescales, which benefit from a stronger model.
 */
export type LLMTask = "import" | "chat";

/**
 * A single turn-taking request. Images, when supplied, are attached to the final
 * user message; every model in use accepts them, so they do not affect which
 * model is chosen.
 */
export interface LLMRequest {
  task: LLMTask;
  systemPrompt?: string;
  messages: Message[];
  images?: string[];
  options?: LLMOptions;
}

export interface StructuredRequest<T> extends LLMRequest {
  /** Constrains generation and validates the reply. */
  schema: z.ZodType<T>;
  /** Provider-facing schema identifier: letters, digits and underscores. */
  schemaName: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments. */
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  name: string;
  arguments: unknown;
}

export interface ToolResponse {
  text: string;
  toolCalls: ToolCall[];
}

export interface ToolRequest extends LLMRequest {
  tools: ToolDefinition[];
}

export interface LLM {
  /** Schema-constrained reply, parsed and validated against `schema`. */
  completeStructured<T>(request: StructuredRequest<T>): Promise<T>;
  /** Text reply that may also invoke any of the supplied tools. */
  completeWithTools(request: ToolRequest): Promise<ToolResponse>;
}

/** Raised when a provider replies with something that isn't usable. */
export class LLMResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LLMResponseError";
  }
}

/**
 * Shared behaviour for every provider. Subclasses supply the three transport
 * methods; schema conversion, JSON parsing and validation happen once, here.
 */
export abstract class BaseLLM implements LLM {
  abstract completeWithTools(request: ToolRequest): Promise<ToolResponse>;

  /** Issue a request constrained to `jsonSchema` and return the raw JSON text. */
  protected abstract completeJson(
    request: LLMRequest,
    schema: { name: string; jsonSchema: Record<string, unknown> }
  ): Promise<string>;

  async completeStructured<T>({
    schema,
    schemaName,
    ...request
  }: StructuredRequest<T>): Promise<T> {
    const raw = await this.completeJson(request, {
      name: schemaName,
      jsonSchema: toProviderJsonSchema(schema),
    });
    return parseAgainstSchema(schema, raw, schemaName);
  }
}

/** Parse provider JSON text and validate it, with errors that name the offending fields. */
export function parseAgainstSchema<T>(
  schema: z.ZodType<T>,
  raw: string,
  schemaName: string
): T {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new LLMResponseError(
      `Expected JSON for "${schemaName}" but the model returned: ${raw.slice(0, 200)}`
    );
  }

  const result = schema.safeParse(value);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new LLMResponseError(
      `Model response did not match the "${schemaName}" schema - ${problems}`
    );
  }

  return result.data;
}
