import { useEffect, useState, useMemo } from "preact/hooks";
import { route } from "preact-router";
import Fuse from "fuse.js";
import type { RecipeWithDetails } from "@recipes/shared";
import { getRecipes, getTags } from "../api/client";
import { RecipeCard } from "../components/RecipeCard";
import { useCookingList } from "../hooks/useCookingList";

type RatingFilter = "all" | "good+" | "great";

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function Home() {
  const [recipes, setRecipes] = useState<RecipeWithDetails[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cookingList = useCookingList();

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [ingredientFilter, setIngredientFilter] = useState("");
  const [showTagFilter, setShowTagFilter] = useState(false);

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
    let results = recipes;

    // Fuzzy search
    if (searchQuery.trim()) {
      const searchResults = fuse.search(searchQuery.trim());
      results = searchResults.map((r) => r.item);
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

    // Tag filter
    if (selectedTags.size > 0) {
      results = results.filter((r) =>
        r.tags.some((t) => selectedTags.has(t.tag))
      );
    }

    // Ingredient filter
    if (ingredientFilter.trim()) {
      const query = ingredientFilter.trim().toLowerCase();
      results = results.filter((r) =>
        r.ingredients.some((ing) => ing.name.toLowerCase().includes(query))
      );
    }

    return results;
  }, [recipes, searchQuery, ratingFilter, selectedTags, ingredientFilter, fuse]);

  function handleSurpriseMe() {
    if (filteredRecipes.length === 0) return;
    const randomIndex = Math.floor(Math.random() * filteredRecipes.length);
    const randomRecipe = filteredRecipes[randomIndex];
    route(`/recipe/${randomRecipe.id}`);
  }

  function toggleTag(tag: string) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }

  function clearFilters() {
    setSearchQuery("");
    setRatingFilter("all");
    setSelectedTags(new Set());
    setIngredientFilter("");
  }

  const hasActiveFilters =
    searchQuery ||
    ratingFilter !== "all" ||
    selectedTags.size > 0 ||
    ingredientFilter;

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
            title="Pick a random recipe"
          >
            Surprise me!
          </button>
        </div>

        {/* Filter chips */}
        <div class="filter-bar">
          <div class="filter-group">
            <span class="filter-label">Rating:</span>
            <button
              class={`filter-chip ${ratingFilter === "all" ? "active" : ""}`}
              onClick={() => setRatingFilter("all")}
            >
              All
            </button>
            <button
              class={`filter-chip ${ratingFilter === "good+" ? "active" : ""}`}
              onClick={() => setRatingFilter("good+")}
            >
              Good+
            </button>
            <button
              class={`filter-chip ${ratingFilter === "great" ? "active" : ""}`}
              onClick={() => setRatingFilter("great")}
            >
              Great
            </button>
          </div>

          <div class="filter-group">
            <button
              class={`filter-chip ${selectedTags.size > 0 ? "active" : ""}`}
              onClick={() => setShowTagFilter(!showTagFilter)}
            >
              Tags {selectedTags.size > 0 && `(${selectedTags.size})`}
            </button>
          </div>

          <div class="filter-group">
            <input
              type="text"
              placeholder="Contains ingredient..."
              value={ingredientFilter}
              onInput={(e) => setIngredientFilter(e.currentTarget.value)}
              class="ingredient-filter-input"
            />
          </div>

          {hasActiveFilters && (
            <button class="btn btn-small" onClick={clearFilters}>
              Clear filters
            </button>
          )}

          <button class="btn btn-small" onClick={reshuffle} title="Reshuffle">
            ↻
          </button>
        </div>

        {/* Tag filter modal */}
        {showTagFilter && allTags.length > 0 && (
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
        )}

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

        {!loading && !error && recipes.length > 0 && filteredRecipes.length === 0 && (
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
