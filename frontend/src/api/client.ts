import type {
  RecipeWithDetails,
  CreateRecipeInput,
  ParsedRecipe,
} from "@recipes/shared";

export interface ImportResult {
  sourceType: "photo" | "url" | "text";
  sourceText: string;
  sourceContext: string | null;
  recipe: ParsedRecipe;
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

export async function importFromPhotos(images: string[]): Promise<ImportResult> {
  return request<ImportResult>("/import/photos", {
    method: "POST",
    body: JSON.stringify({ images }),
  });
}

export async function importFromText(text: string): Promise<ImportResult> {
  return request<ImportResult>("/import/text", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function generateRecipe(prompt: string): Promise<ImportResult> {
  return request<ImportResult>("/import/generate", {
    method: "POST",
    body: JSON.stringify({ prompt }),
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

export async function getChatHistory(recipeId: number): Promise<ChatMessage[]> {
  return request<ChatMessage[]>(`/recipes/${recipeId}/chat`);
}

export async function clearChatHistory(recipeId: number): Promise<void> {
  await request(`/recipes/${recipeId}/chat`, { method: "DELETE" });
}

export async function sendChatMessage(
  recipeId: number,
  message: string
): Promise<ChatResponse> {
  return request<ChatResponse>(`/recipes/${recipeId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}
