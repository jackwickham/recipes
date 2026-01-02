import { useEffect, useState } from "preact/hooks";
import { route } from "preact-router";
import type { RecipeWithDetails, CreateRecipeInput } from "@recipes/shared";
import { getRecipe, updateRecipe } from "../api/client";
import { RecipeForm } from "../components/RecipeForm";

interface Props {
  id?: string;
}

export function EditRecipe({ id }: Props) {
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadRecipe(parseInt(id, 10));
    }
  }, [id]);

  async function loadRecipe(recipeId: number) {
    try {
      setLoading(true);
      setError(null);
      const data = await getRecipe(recipeId);
      setRecipe(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipe");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(data: CreateRecipeInput) {
    if (!recipe) return;
    await updateRecipe(recipe.id, data);
    route(`/recipe/${recipe.id}`);
  }

  if (loading) {
    return (
      <div class="page">
        <p class="loading">Loading recipe...</p>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div class="page">
        <header class="header">
          <a href="/" class="btn">
            Back
          </a>
          <h1>Error</h1>
        </header>
        <p class="error">{error || "Recipe not found"}</p>
      </div>
    );
  }

  return (
    <div class="page">
      <header class="header">
        <a href={`/recipe/${recipe.id}`} class="btn">
          Cancel
        </a>
        <h1>Edit: {recipe.title}</h1>
      </header>
      <main>
        <RecipeForm
          recipe={recipe}
          onSubmit={handleSubmit}
          onCancel={() => route(`/recipe/${recipe.id}`)}
          submitLabel="Save Changes"
        />
      </main>
    </div>
  );
}
