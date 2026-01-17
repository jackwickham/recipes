import { useEffect, useState, useMemo } from "preact/hooks";
import { route } from "preact-router";
import Fuse from "fuse.js";
import type { RecipeWithDetails, ParsedRecipe } from "@recipes/shared";
import {
  getRecipe,
  getRecipes,
  updateRating,
  deleteRecipe,
  createRecipe,
  updateRecipe,
  scaleRecipe,
} from "../api/client";
import { PortionPicker } from "../components/PortionPicker";
import { Timer } from "../components/Timer";
import { ChatModal } from "../components/ChatModal";
import { RecipePreviewModal } from "../components/RecipePreviewModal";
import { PortionInputModal } from "../components/PortionInputModal";
import { useTimer } from "../hooks/useTimer";
import { useWakeLock } from "../hooks/useWakeLock";
import { useCookingList } from "../hooks/useCookingList";
import {
  renderStepText,
  extractTimers,
  formatQuantityWithUnit,
} from "../utils/scaling";
import { useFilters } from "../contexts/FilterContext";

interface Props {
  id?: string;
  path?: string;
}

function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function RecipeDetail({ id }: Props) {
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(
    new Set()
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInitialMessage, setChatInitialMessage] = useState<
    string | undefined
  >(undefined);
  const [chatAutoSend, setChatAutoSend] = useState(false);

  // Scaling state
  const [scalingLoading, setScalingLoading] = useState(false);
  const [showPortionInput, setShowPortionInput] = useState(false);
  const [showScalePreview, setShowScalePreview] = useState(false);
  const [scaledRecipe, setScaledRecipe] = useState<ParsedRecipe | null>(null);

  const { timers, startTimer, stopTimer, resetTimer, getTimer } = useTimer();
  const wakeLock = useWakeLock();
  const cookingList = useCookingList();
  const {
    searchQuery,
    ratingFilter,
    selectedTags,
    ingredientFilter,
  } = useFilters();

  useEffect(() => {
    loadRecipe();
  }, [id, window.location.search]); // Re-run when query params change

  async function loadRecipe() {
    if (!id) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getRecipe(parseInt(id, 10));

      // Check if user requested a specific portion via query param
      const urlParams = new URLSearchParams(window.location.search);
      const servingsParam = urlParams.get('servings');
      const requestedServings = servingsParam ? parseInt(servingsParam, 10) : null;

      // If servings requested and variant exists, load that variant instead
      if (requestedServings && data.portionVariants) {
        const variant = data.portionVariants.find(v => v.servings === requestedServings);
        if (variant && variant.id !== data.id) {
          const variantData = await getRecipe(variant.id);

          // IMPORTANT: Inherit contentVariants from parent to show consistent variants
          // across all portion sizes
          variantData.contentVariants = data.contentVariants;

          setRecipe(variantData);
          setLoading(false);
          return;
        }
      }

      // Otherwise load the parent recipe as-is
      setRecipe(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipe");
    } finally {
      setLoading(false);
    }
  }

  // Shuffle content variants once when recipe loads
  const shuffledContentVariants = useMemo(
    () => (recipe?.contentVariants ? shuffleArray(recipe.contentVariants) : []),
    [recipe?.contentVariants]
  );

  function handlePortionChange(servings: number) {
    // Only route to parent if this is specifically a portion variant.
    // Content variants should act as the "base" for their own portion variants.
    const baseId =
      recipe?.variantType === "portion" && recipe.parentRecipeId
        ? recipe.parentRecipeId
        : recipe?.id;

    if (baseId) {
      route(`/recipe/${baseId}?servings=${servings}`);
    }
  }

  async function handleRequestNewPortion() {
    if (!recipe) return;
    setShowPortionInput(true);
  }

  async function handlePortionSubmit(portions: number) {
    if (!recipe) return;
    setShowPortionInput(false);

    try {
      setScalingLoading(true);
      const scaled = await scaleRecipe(recipe.id, portions);
      setScaledRecipe(scaled);
      setShowScalePreview(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to scale recipe");
    } finally {
      setScalingLoading(false);
    }
  }

  async function handleRatingChange(rating: "meh" | "good" | "great" | null) {
    if (!recipe) return;
    const newRating = recipe.rating === rating ? null : rating;
    try {
      await updateRating(recipe.id, newRating);
      setRecipe({ ...recipe, rating: newRating });
    } catch (err) {
      console.error("Failed to update rating:", err);
    }
  }

  function toggleIngredient(ingredientId: number) {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(ingredientId)) {
        next.delete(ingredientId);
      } else {
        next.add(ingredientId);
      }
      return next;
    });
  }

  async function handleDelete() {
    if (!recipe) return;
    try {
      await deleteRecipe(recipe.id);
      route("/");
    } catch (err) {
      console.error("Failed to delete recipe:", err);
    }
  }

  function closeChat() {
    setShowChat(false);
    setChatInitialMessage(undefined);
    setChatAutoSend(false);
  }

  function closePreview() {
    setShowScalePreview(false);
    setScaledRecipe(null);
  }

  async function handleSaveAsNew(parsed: ParsedRecipe) {
    try {
      const newRecipe = await createRecipe({
        title: parsed.title,
        description: parsed.description,
        servings: parsed.servings,
        prepTimeMinutes: parsed.prepTimeMinutes,
        cookTimeMinutes: parsed.cookTimeMinutes,
        sourceType: "text",
        sourceText: null,
        sourceContext: recipe ? `Modified from: ${recipe.title}` : null,
        ingredients: parsed.ingredients,
        steps: parsed.steps,
        tags: (parsed.suggestedTags || []).map((tag) => ({
          tag,
          isAutoGenerated: true,
        })),
      });
      closeChat();
      closePreview();
      route(`/recipe/${newRecipe.id}`);
    } catch (err) {
      console.error("Failed to save recipe:", err);
    }
  }

  async function handleSaveAsVariant(parsed: ParsedRecipe) {
    if (!recipe) return;

    // Calculate the Base ID (the root of the portion variant tree)
    // If current recipe is a portion variant, its parent is the base.
    // If current recipe is base or content variant, it IS the base.
    const baseId =
      recipe.variantType === "portion" && recipe.parentRecipeId
        ? recipe.parentRecipeId
        : recipe.id;

    // Determine the target parent ID
    // If creating a PORTION variant, force it to attach to the base ID
    // Otherwise (e.g. content variant), respect LLM's choice or default to baseId
    const finalParentId =
      parsed.variantType === "portion"
        ? baseId
        : parsed.parentRecipeId ?? baseId;

    try {
      const newRecipe = await createRecipe({
        title: parsed.title,
        description: parsed.description,
        servings: parsed.servings,
        prepTimeMinutes: parsed.prepTimeMinutes,
        cookTimeMinutes: parsed.cookTimeMinutes,
        sourceType: "text",
        sourceText: null,
        sourceContext: `Variant of: ${recipe.title}`,
        parentRecipeId: finalParentId,
        variantType: parsed.variantType ?? null,
        ingredients: parsed.ingredients,
        steps: parsed.steps,
        tags: (parsed.suggestedTags || []).map((tag) => ({
          tag,
          isAutoGenerated: true,
        })),
      });
      closeChat();
      closePreview();

      // Navigate to parent with servings query param if it's a portion variant
      if (newRecipe.variantType === "portion") {
        route(`/recipe/${baseId}?servings=${newRecipe.servings}`);
      } else {
        // Content variant - navigate to its own ID
        route(`/recipe/${newRecipe.id}`);
      }
    } catch (err) {
      console.error("Failed to save variant:", err);
    }
  }

  async function handleReplaceRecipe(parsed: ParsedRecipe) {
    if (!recipe) return;
    try {
      await updateRecipe(recipe.id, {
        title: parsed.title,
        description: parsed.description,
        servings: parsed.servings,
        prepTimeMinutes: parsed.prepTimeMinutes,
        cookTimeMinutes: parsed.cookTimeMinutes,
        ingredients: parsed.ingredients,
        steps: parsed.steps,
        tags: (parsed.suggestedTags || []).map((tag) => ({
          tag,
          isAutoGenerated: true,
        })),
      });
      closeChat();
      closePreview();
      loadRecipe();
    } catch (err) {
      console.error("Failed to update recipe:", err);
    }
  }

  async function handleSurpriseMe() {
    try {
      const allRecipes = await getRecipes();

      // Start with non-variants and exclude current recipe
      let candidates = allRecipes.filter(
        (r) => r.parentRecipeId === null && r.id !== recipe?.id
      );

      // Apply filters from context (same logic as Home.tsx)

      // Fuzzy search
      if (searchQuery.trim()) {
        const fuse = new Fuse(candidates, {
          keys: [
            { name: "title", weight: 2 },
            { name: "description", weight: 1 },
            { name: "ingredients.name", weight: 1.5 },
            { name: "tags.tag", weight: 1 },
          ],
          threshold: 0.4,
          includeScore: true,
        });
        const searchResults = fuse.search(searchQuery.trim());
        candidates = searchResults.map((r) => r.item);
      }

      // Rating filter
      if (ratingFilter !== "all") {
        candidates = candidates.filter((r) => {
          if (ratingFilter === "great") return r.rating === "great";
          if (ratingFilter === "good+")
            return r.rating === "good" || r.rating === "great";
          return true;
        });
      }

      // Tag filter (AND logic - recipe must have ALL selected tags)
      if (selectedTags.size > 0) {
        candidates = candidates.filter((r) => {
          const recipeTags = new Set(r.tags.map((t) => t.tag));
          return Array.from(selectedTags).every((tag) => recipeTags.has(tag));
        });
      }

      // Ingredient filter
      if (ingredientFilter.trim()) {
        const query = ingredientFilter.trim().toLowerCase();
        candidates = candidates.filter((r) =>
          r.ingredients.some((ing) => ing.name.toLowerCase().includes(query))
        );
      }

      if (candidates.length > 0) {
        const random = candidates[Math.floor(Math.random() * candidates.length)];
        route(`/recipe/${random.id}`);
      }
    } catch (err) {
      console.error("Failed to surprise me:", err);
    }
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
    <div class="page recipe-detail">
      <header class="header">
        <a href="/" class="btn">
          Back
        </a>
        <h1>{recipe.title}</h1>
        <div class="header-actions">
          <button
            class="btn"
            onClick={handleSurpriseMe}
            title="Show me another random recipe"
          >
            🎲
          </button>
          <a href={`/edit/${recipe.id}`} class="btn">
            Edit
          </a>
          <button
            class="btn btn-danger"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete
          </button>
        </div>
      </header>

      <main>
        {recipe.parentRecipe && recipe.variantType !== 'portion' && (
          <a href={`/recipe/${recipe.parentRecipe.id}`} class="parent-recipe-link">
            ← Variant of: {recipe.parentRecipe.title}
          </a>
        )}

        {recipe.description && (
          <p class="recipe-description">{recipe.description}</p>
        )}

        <div class="recipe-meta">
          {recipe.prepTimeMinutes && (
            <span>Prep: {formatDuration(recipe.prepTimeMinutes)}</span>
          )}
          {recipe.cookTimeMinutes && (
            <span>Cook: {formatDuration(recipe.cookTimeMinutes)}</span>
          )}
          {recipe.servings && <span>Serves {recipe.servings}</span>}
        </div>

        <div class="recipe-controls">
          <div class="rating-buttons">
            <button
              class={`rating-btn rating-meh ${recipe.rating === "meh" ? "active" : ""}`}
              onClick={() => handleRatingChange("meh")}
              title="Meh"
            >
              👎
            </button>
            <button
              class={`rating-btn rating-good ${recipe.rating === "good" ? "active" : ""}`}
              onClick={() => handleRatingChange("good")}
              title="Good"
            >
              👍
            </button>
            <button
              class={`rating-btn rating-great ${recipe.rating === "great" ? "active" : ""}`}
              onClick={() => handleRatingChange("great")}
              title="Great"
            >
              <span class="thumbs-double">
                <span class="thumb-back">👍</span>
                <span class="thumb-front">👍</span>
              </span>
            </button>
          </div>

          {wakeLock.isSupported && (
            <button
              class={`btn wake-lock-btn ${wakeLock.isActive ? "active" : ""}`}
              onClick={wakeLock.toggle}
            >
              {wakeLock.isActive ? "Screen On" : "Keep Awake"}
            </button>
          )}

          {cookingList.isInList(recipe.id) ? (
            <button
              class="btn"
              onClick={() => cookingList.removeRecipe(recipe.id)}
            >
              Remove from List
            </button>
          ) : (
            <button
              class="btn btn-primary"
              onClick={() => cookingList.addRecipe(recipe.id, recipe.title)}
            >
              Add to List
            </button>
          )}

          <button class="btn" onClick={() => setShowChat(true)}>
            Chat
          </button>
        </div>

        {recipe.tags.length > 0 && (
          <div class="recipe-tags">
            {recipe.tags.map((t) => (
              <span key={t.id} class="tag-chip">
                {t.tag}
              </span>
            ))}
          </div>
        )}

        {/* Portion Picker for recipes with portion variants */}
        <PortionPicker
          currentServings={recipe.servings || 1}
          portionVariants={recipe.portionVariants || []}
          parentRecipeId={recipe.parentRecipeId || recipe.id}
          onPortionChange={handlePortionChange}
          onRequestNewPortion={handleRequestNewPortion}
        />

        {/* Content variants (different recipes, not just different portions) */}
        {shuffledContentVariants.length > 0 && (
          <div class="variants-section">
            <h3 class="variants-title">Also try</h3>
            <div class="variants-carousel">
              {shuffledContentVariants.map((v) => (
                <a key={v.id} href={`/recipe/${v.id}`} class="variant-card">
                  <div class="variant-card-content">
                    <span class="variant-card-title">{v.title}</span>
                    {v.description && (
                      <span class="variant-card-description">
                        {v.description}
                      </span>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {recipe.ingredients.length > 0 && (
          <section class="recipe-section">
            <h2>Ingredients</h2>
            <ul class="ingredient-list">
              {recipe.ingredients.map((ing) => (
                <li key={ing.id} class="ingredient-item">
                  <input
                    type="checkbox"
                    class="ingredient-checkbox"
                    checked={checkedIngredients.has(ing.id)}
                    onChange={() => toggleIngredient(ing.id)}
                  />
                  <span class="ingredient-quantity">
                    {formatQuantityWithUnit(ing.quantity, ing.unit)}
                  </span>
                  <span class="ingredient-name">{ing.name}</span>
                  {ing.notes && (
                    <span class="ingredient-notes">({ing.notes})</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {recipe.steps.length > 0 && (
          <section class="recipe-section">
            <h2>Method</h2>
            <ol class="step-list">
              {recipe.steps.map((step, idx) => {
                const stepTimers = extractTimers(step.instruction);
                const renderedText = renderStepText(step.instruction);

                return (
                  <li key={step.id} class="step-item">
                    <span class="step-number">{idx + 1}</span>
                    <div class="step-content">
                      <p>{renderedText}</p>
                      <div class="step-timers">
                        {stepTimers.map((t, timerIdx) => {
                          const timerId = `step-${step.id}-timer-${timerIdx}`;
                          const timer = getTimer(timerId);

                          return (
                            <Timer
                              key={timerId}
                              timer={timer}
                              minutes={t.minutes}
                              onStart={() => startTimer(timerId, t.minutes)}
                              onStop={() => stopTimer(timerId)}
                              onReset={() => resetTimer(timerId)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {recipe.sourceContext && (
          <section class="recipe-section">
            <h2>Source</h2>
            <p>{recipe.sourceContext}</p>
          </section>
        )}

      </main>

      {showDeleteConfirm && (
        <div
          class="confirm-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div class="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Recipe?</h3>
            <p>
              Are you sure you want to delete "{recipe.title}"? This cannot be
              undone.
            </p>
            <div class="confirm-actions">
              <button class="btn" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </button>
              <button class="btn btn-danger" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <ChatModal
        recipeId={recipe.id}
        recipeTitle={recipe.title}
        isOpen={showChat}
        onClose={closeChat}
        onSaveAsNew={handleSaveAsNew}
        onSaveAsVariant={handleSaveAsVariant}
        onReplaceRecipe={handleReplaceRecipe}
        initialMessage={chatInitialMessage}
        autoSendInitial={chatAutoSend}
        autoSavePortionVariants={chatAutoSend}
      />

      {scaledRecipe && (
        <RecipePreviewModal
          recipe={scaledRecipe}
          isOpen={showScalePreview}
          onClose={closePreview}
          onSave={handleSaveAsVariant}
          title={`Scale to ${scaledRecipe.servings} portions`}
        />
      )}

      <PortionInputModal
        isOpen={showPortionInput}
        onClose={() => setShowPortionInput(false)}
        onSubmit={handlePortionSubmit}
        initialValue={recipe.servings || 4}
      />

      {scalingLoading && (
        <div class="confirm-overlay">
          <div class="confirm-dialog">
            <p class="loading">Scaling recipe...</p>
          </div>
        </div>
      )}
    </div>
  );
}
