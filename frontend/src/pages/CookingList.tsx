import { useEffect, useState, useMemo } from "preact/hooks";
import type { RecipeWithDetails } from "@recipes/shared";
import { getRecipe } from "../api/client";
import { useCookingList } from "../hooks/useCookingList";
import { formatQuantity } from "../utils/scaling";

export function CookingList({ path }: { path?: string }) {
  const { items, removeRecipe, clearList } = useCookingList();
  const [loadedRecipes, setLoadedRecipes] = useState<
    Map<number, RecipeWithDetails>
  >(new Map());
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"recipes" | "shopping">("recipes");

  useEffect(() => {
    const missingIds = items
      .filter((item) => !loadedRecipes.has(item.id))
      .map((i) => i.id);

    if (missingIds.length > 0) {
      loadRecipes(missingIds);
    }
  }, [items]);

  async function loadRecipes(ids: number[]) {
    setLoading(true);
    try {
      const promises = ids.map((id) => getRecipe(id).catch(() => null));
      const results = await Promise.all(promises);
      setLoadedRecipes((prev) => {
        const next = new Map(prev);
        results.forEach((r) => {
          if (r) next.set(r.id, r);
        });
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  const shoppingList = useMemo(() => {
    const ingredients = new Map<
      string,
      { name: string; quantity: number; unit: string | null }
    >();

    items.forEach((item) => {
      const recipe = loadedRecipes.get(item.id);
      if (!recipe) return;

      recipe.ingredients.forEach((ing) => {
        // normalization key: lower case name + unit
        const key = `${ing.name.toLowerCase().trim()}|${ing.unit || ""}`;
        const current = ingredients.get(key);
        const addedQty = ing.quantity || 0;

        if (current) {
          current.quantity += addedQty;
        } else {
          ingredients.set(key, {
            name: ing.name.trim(), // Keep original casing of first occurrence
            quantity: addedQty,
            unit: ing.unit || null,
          });
        }
      });
    });

    return Array.from(ingredients.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [items, loadedRecipes]);

  return (
    <div class="page">
      <header class="header">
        <a href="/" class="btn">
          Back
        </a>
        <h1>Cooking List</h1>
        {items.length > 0 && (
          <div class="header-actions">
            <button
              class={`btn ${viewMode === "recipes" ? "btn-primary" : ""}`}
              onClick={() => setViewMode("recipes")}
            >
              Recipes
            </button>
            <button
              class={`btn ${viewMode === "shopping" ? "btn-primary" : ""}`}
              onClick={() => setViewMode("shopping")}
            >
              Shopping List
            </button>
            <button class="btn btn-danger" onClick={clearList}>
              Clear All
            </button>
          </div>
        )}
      </header>

      <main>
        {items.length === 0 ? (
          <div class="empty-state">
            <p>Your cooking list is empty.</p>
            <p>Add recipes from the recipe detail page to plan your cooking!</p>
            <div class="empty-state-actions">
              <a href="/" class="btn btn-primary">
                Browse Recipes
              </a>
            </div>
          </div>
        ) : (
          <>
            {viewMode === "recipes" && (
              <div class="cooking-list-items">
                {items.map((item) => {
                  const recipe = loadedRecipes.get(item.id);

                  if (!recipe && loading) {
                    return (
                      <div key={item.id} class="cooking-list-card loading">
                        Loading {item.title}...
                      </div>
                    );
                  }

                  if (!recipe && !loading && loadedRecipes.size > 0) {
                    // Only show error if we've tried loading and it's missing
                    return (
                      <div key={item.id} class="cooking-list-card error">
                        Failed to load {item.title}
                        <button
                          class="btn btn-small btn-danger"
                          onClick={() => removeRecipe(item.id)}
                          style={{ marginLeft: "1rem" }}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  }

                  if (!recipe) return null;

                  return (
                    <div key={item.id} class="cooking-list-card">
                      <div class="cooking-list-card-header">
                        <h3>
                          <a href={`/recipe/${item.id}`}>{item.title}</a>
                        </h3>
                        <button
                          class="btn btn-small"
                          onClick={() => removeRecipe(item.id)}
                          title="Remove from list"
                        >
                          ×
                        </button>
                      </div>
                      {recipe.servings && (
                        <span class="cooking-list-servings">
                          {recipe.servings} portions
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {viewMode === "shopping" && (
              <div class="shopping-list">
                <h2>Combined Ingredients</h2>
                <ul class="ingredient-list">
                  {shoppingList.map((item, idx) => (
                    <li key={idx} class="ingredient-item">
                      <input type="checkbox" class="ingredient-checkbox" />
                      <span class="ingredient-quantity">
                        {item.quantity > 0
                          ? formatQuantity(item.quantity, item.unit)
                          : ""}
                      </span>
                      <span class="ingredient-name">{item.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}