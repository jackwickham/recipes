import { useEffect, useState, useMemo, useRef } from "preact/hooks";
import { route } from "preact-router";
import Fuse from "fuse.js";
import type { RecipeWithDetails } from "@recipes/shared";
import { getRecipes, getTags } from "../api/client";
import { RecipeCard } from "../components/RecipeCard";
import { RecipeGenerator } from "../components/RecipeGenerator";
import { useCookingList } from "../hooks/useCookingList";
import { useFilters } from "../contexts/FilterContext";

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function Home({ path }: { path?: string }) {
  const [recipes, setRecipes] = useState<RecipeWithDetails[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cookingList = useCookingList();

  // Use filter context instead of local state
  const {
    searchQuery,
    ratingFilter,
    selectedTags,
    ingredientFilter,
    setSearchQuery,
    setRatingFilter,
    toggleTag,
    setIngredientFilter,
    clearFilters,
    hasActiveFilters,
  } = useFilters();

  const [showTagFilter, setShowTagFilter] = useState(false);
  const tagFilterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        tagFilterRef.current &&
        !tagFilterRef.current.contains(event.target as Node)
      ) {
        setShowTagFilter(false);
      }
    }

    if (showTagFilter) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showTagFilter]);

  useEffect(() => {
    loadRecipes();
    loadTags();
  }, []);

  async function loadRecipes() {
    try {
      setLoading(true);
      setError(null);
      const data = await getRecipes();
      setRecipes(shuffleArray(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipes");
    } finally {
      setLoading(false);
    }
  }

  async function loadTags() {
    try {
      const tags = await getTags();
      setAllTags(tags);
    } catch {
      // Ignore tag loading errors
    }
  }

  function reshuffle() {
    setRecipes(shuffleArray([...recipes]));
  }

  // Fuse.js search instance
  const fuse = useMemo(() => {
    return new Fuse(recipes, {
      keys: [
        { name: "title", weight: 2 },
        { name: "description", weight: 1 },
        { name: "ingredients.name", weight: 1.5 },
        { name: "tags.tag", weight: 1 },
      ],
      threshold: 0.4,
      includeScore: true,
    });
  }, [recipes]);

  // Apply filters
  const filteredRecipes = useMemo(() => {
    // Exclude variants (recipes with a parent) from the main view
    let results = recipes.filter((r) => r.parentRecipeId === null);

    // Fuzzy search
    if (searchQuery.trim()) {
      const searchResults = fuse.search(searchQuery.trim());
      // Filter search results to exclude variants
      results = searchResults
        .map((r) => r.item)
        .filter((r) => r.parentRecipeId === null);
    }

    // Rating filter
    if (ratingFilter !== "all") {
      results = results.filter((r) => {
        if (ratingFilter === "great") return r.rating === "great";
        if (ratingFilter === "good+")
          return r.rating === "good" || r.rating === "great";
        return true;
      });
    }

    // Tag filter (AND logic - recipe must have ALL selected tags)
    if (selectedTags.size > 0) {
      results = results.filter((r) => {
        const recipeTags = new Set(r.tags.map((t) => t.tag));
        return Array.from(selectedTags).every((tag) => recipeTags.has(tag));
      });
    }

    // Ingredient filter
    if (ingredientFilter.trim()) {
      const query = ingredientFilter.trim().toLowerCase();
      results = results.filter((r) =>
        r.ingredients.some((ing) => ing.name.toLowerCase().includes(query))
      );
    }

    return results;
  }, [
    recipes,
    searchQuery,
    ratingFilter,
    selectedTags,
    ingredientFilter,
    fuse,
  ]);

  function handleSurpriseMe() {
    if (filteredRecipes.length === 0) return;
    const randomIndex = Math.floor(Math.random() * filteredRecipes.length);
    const randomRecipe = filteredRecipes[randomIndex];
    route(`/recipe/${randomRecipe.id}`);
  }

  return (
    <div class="page">
      <header class="header">
        <h1>Recipes</h1>
        <div class="header-actions">
          <a href="/list" class="btn">
            Cooking List{cookingList.count > 0 && ` (${cookingList.count})`}
          </a>
          <a href="/add" class="btn btn-primary">
            Add Recipe
          </a>
        </div>
      </header>

      <main>
        {/* Recipe Generator */}
        <RecipeGenerator onRecipeCreated={loadRecipes} />

        {/* Search bar */}
        <div class="search-bar">
          <input
            type="search"
            placeholder="Search recipes..."
            value={searchQuery}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="search-input"
          />
          <button
            class="btn"
            onClick={handleSurpriseMe}
            disabled={filteredRecipes.length === 0}
            title={
              filteredRecipes.length === 0
                ? "No recipes available"
                : "Pick a random recipe"
            }
          >
            Surprise me!
          </button>
        </div>

        {/* Filter bar */}
        <div class="filter-bar">
          <div class="filter-bar-left">
            <div class="filter-group rating-filter">
              <button
                class={`rating-chip ${ratingFilter === "all" ? "active" : ""}`}
                onClick={() => setRatingFilter("all")}
              >
                All
              </button>
              <button
                class={`rating-chip rating-good ${
                  ratingFilter === "good+" ? "active" : ""
                }`}
                onClick={() => setRatingFilter("good+")}
                title="Good or better"
              >
                👍+
              </button>
              <button
                class={`rating-chip rating-great ${
                  ratingFilter === "great" ? "active" : ""
                }`}
                onClick={() => setRatingFilter("great")}
                title="Great only"
              >
                👍👍
              </button>
            </div>

            <div class="filter-group tags-filter-container" ref={tagFilterRef}>
              <button
                class={`filter-chip tags-toggle ${showTagFilter ? "open" : ""}`}
                onClick={() => setShowTagFilter(!showTagFilter)}
              >
                Tags
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  class={`tags-toggle-icon ${showTagFilter ? "open" : ""}`}
                >
                  <path
                    fill-rule="evenodd"
                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                    clip-rule="evenodd"
                  />
                </svg>
              </button>

              {showTagFilter && allTags.length > 0 && (
                <div class="tag-filter-popover">
                  <div class="tag-filter-dropdown">
                    {allTags.map((tag) => (
                      <button
                        key={tag}
                        class={`tag-chip ${selectedTags.has(tag) ? "selected" : ""}`}
                        onClick={() => toggleTag(tag)}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Selected tags display inside the bar */}
            {selectedTags.size > 0 && (
              <div class="selected-tags-inline">
                {Array.from(selectedTags).map((tag) => (
                  <button
                    key={tag}
                    class="selected-tag-mini"
                    onClick={() => toggleTag(tag)}
                    title="Remove tag"
                  >
                    {tag} ×
                  </button>
                ))}
              </div>
            )}

            <div class="filter-group ingredient-filter">
              <span class="ingredient-filter-icon">🥕</span>
              <input
                type="text"
                placeholder="Filter by ingredient..."
                value={ingredientFilter}
                onInput={(e) => setIngredientFilter(e.currentTarget.value)}
                class="ingredient-filter-input"
              />
            </div>
          </div>

          <div class="filter-bar-right">
            {hasActiveFilters && (
              <button class="btn btn-small" onClick={clearFilters}>
                Clear
              </button>
            )}
            <button
              class="btn btn-small reshuffle-btn"
              onClick={reshuffle}
              title="Reshuffle order"
            >
              ↻
            </button>
          </div>
        </div>

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

        {!loading &&
          !error &&
          recipes.length > 0 &&
          filteredRecipes.length === 0 && (
            <div class="empty-state">
              <p>No recipes match your filters.</p>
              <button class="btn" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          )}

        {!loading && !error && filteredRecipes.length > 0 && (
          <div class="recipe-grid">
            {filteredRecipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
