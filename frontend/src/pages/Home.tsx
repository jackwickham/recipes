import { useEffect, useState } from "preact/hooks";
import type { RecipeWithDetails } from "@recipes/shared";
import { getRecipes } from "../api/client";
import { RecipeCard } from "../components/RecipeCard";

export function Home() {
  const [recipes, setRecipes] = useState<RecipeWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRecipes();
  }, []);

  async function loadRecipes() {
    try {
      setLoading(true);
      setError(null);
      const data = await getRecipes();
      // Shuffle for random order
      setRecipes(data.sort(() => Math.random() - 0.5));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipes");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div class="page">
      <header class="header">
        <h1>Recipes</h1>
        <div class="header-actions">
          <a href="/list" class="btn">
            Cooking List
          </a>
          <a href="/add" class="btn btn-primary">
            Add Recipe
          </a>
        </div>
      </header>

      <main>
        {loading && <p class="loading">Loading recipes...</p>}

        {error && <p class="error">{error}</p>}

        {!loading && !error && recipes.length === 0 && (
          <div class="empty-state">
            <p>No recipes yet.</p>
            <a href="/add" class="btn btn-primary">
              Add your first recipe
            </a>
          </div>
        )}

        {!loading && !error && recipes.length > 0 && (
          <div class="recipe-grid">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
