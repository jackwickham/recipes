import type {
  RecipeWithDetails,
  CreateRecipeInput,
  ParsedRecipe,
  ParsedRecipeResult,
  ParsedRecipeWithVariants,
} from "@recipes/shared";

export interface ImportResult {
  sourceType: "photo" | "url" | "text";
  sourceText: string;
  sourceContext: string | null;
  recipe: ParsedRecipeResult;
}

const API_BASE = "/api";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || "Request failed");
  }

  return res.json();
}

export async function getRecipes(): Promise<RecipeWithDetails[]> {
  return request<RecipeWithDetails[]>("/recipes");
}

export async function getRecipe(id: number): Promise<RecipeWithDetails> {
  return request<RecipeWithDetails>(`/recipes/${id}`);
}

export async function createRecipe(
  input: CreateRecipeInput
): Promise<RecipeWithDetails> {
  return request<RecipeWithDetails>("/recipes", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateRecipe(
  id: number,
  input: Partial<CreateRecipeInput>
): Promise<RecipeWithDetails> {
  return request<RecipeWithDetails>(`/recipes/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteRecipe(id: number): Promise<void> {
  await request(`/recipes/${id}`, { method: "DELETE" });
}

export async function updateRating(
  id: number,
  rating: "meh" | "good" | "great" | null
): Promise<void> {
  await request(`/recipes/${id}/rating`, {
    method: "PATCH",
    body: JSON.stringify({ rating }),
  });
}

export async function getTags(): Promise<string[]> {
  return request<string[]>("/tags");
}

export async function importFromUrl(url: string): Promise<ImportResult> {
  return request<ImportResult>("/import/url", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export async function importFromUrlWithProgress(
  url: string,
  onProgress: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const response = await fetch(`${API_BASE}/import/url/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Request failed");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events from buffer
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = JSON.parse(line.slice(6));

        onProgress({
          stage: data.stage,
          message: data.message,
        });

        if (data.stage === "complete") {
          return data.data as ImportResult;
        }

        if (data.stage === "error") {
          throw new Error(data.message || "Import failed");
        }
      }
    }
  }

  throw new Error("Stream ended without completion");
}

export async function importFromPhotos(images: string[]): Promise<ImportResult> {
  return request<ImportResult>("/import/photos", {
    method: "POST",
    body: JSON.stringify({ images }),
  });
}

export interface ImportProgress {
  stage: "fetching" | "extracting" | "parsing" | "complete" | "error";
  message: string;
}

export async function importFromPhotosWithProgress(
  images: string[],
  onProgress: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const response = await fetch(`${API_BASE}/import/photos/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Request failed");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events from buffer
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = JSON.parse(line.slice(6));

        onProgress({
          stage: data.stage,
          message: data.message,
        });

        if (data.stage === "complete") {
          return data.data as ImportResult;
        }

        if (data.stage === "error") {
          throw new Error(data.message || "Import failed");
        }
      }
    }
  }

  throw new Error("Stream ended without completion");
}

export async function importFromText(text: string): Promise<ImportResult> {
  return request<ImportResult>("/import/text", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function importFromTextWithProgress(
  text: string,
  onProgress: (progress: ImportProgress) => void
): Promise<ImportResult> {
  const response = await fetch(`${API_BASE}/import/text/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: response.statusText }));
    throw new Error(error.error || "Request failed");
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse SSE events from buffer
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = JSON.parse(line.slice(6));

        onProgress({
          stage: data.stage,
          message: data.message,
        });

        if (data.stage === "complete") {
          return data.data as ImportResult;
        }

        if (data.stage === "error") {
          throw new Error(data.message || "Processing failed");
        }
      }
    }
  }

  throw new Error("Stream ended without completion");
}

export async function generateRecipe(prompt: string): Promise<ImportResult> {
  return request<ImportResult>("/import/generate", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}

export interface CreateWithVariantsResult {
  recipe: RecipeWithDetails;
  allIds: number[];
}

export async function createRecipeWithVariants(
  parsed: ParsedRecipeWithVariants,
  sourceType: "photo" | "url" | "text",
  sourceText: string | null,
  sourceContext: string | null
): Promise<CreateWithVariantsResult> {
  return request<CreateWithVariantsResult>("/recipes/with-variants", {
    method: "POST",
    body: JSON.stringify({ parsed, sourceType, sourceText, sourceContext }),
  });
}

export async function scaleRecipe(
  id: number,
  targetServings: number
): Promise<ParsedRecipe> {
  return request<ParsedRecipe>(`/recipes/${id}/scale`, {
    method: "POST",
    body: JSON.stringify({ targetServings }),
  });
}

// Chat
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  metadata?: string | null;
  createdAt: string;
}

export interface ChatResponse {
  message: string;
  updatedRecipes: ParsedRecipe[];
}

export async function sendChatMessage(
  recipeId: number,
  message: string,
  history: ChatMessage[]
): Promise<ChatResponse> {
  return request<ChatResponse>(`/recipes/${recipeId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}
