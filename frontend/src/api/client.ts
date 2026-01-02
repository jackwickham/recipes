import type {
  RecipeWithDetails,
  CreateRecipeInput,
} from "@recipes/shared";

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
