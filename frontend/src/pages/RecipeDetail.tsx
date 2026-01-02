import { useEffect, useState } from "preact/hooks";
import { route } from "preact-router";
import type { RecipeWithDetails } from "@recipes/shared";
import { getRecipe, updateRating, deleteRecipe } from "../api/client";
import { ScalingControls } from "../components/ScalingControls";
import { Timer } from "../components/Timer";
import { useTimer } from "../hooks/useTimer";
import { useWakeLock } from "../hooks/useWakeLock";
import {
  formatQuantity,
  renderStepText,
  extractTimers,
} from "../utils/scaling";

interface Props {
  id?: string;
}

function formatDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function RecipeDetail({ id }: Props) {
  const [recipe, setRecipe] = useState<RecipeWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(
    new Set()
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentServings, setCurrentServings] = useState<number>(1);

  const { timers, startTimer, stopTimer, resetTimer, getTimer } = useTimer();
  const wakeLock = useWakeLock();

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
      setCurrentServings(data.servings || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recipe");
    } finally {
      setLoading(false);
    }
  }

  const baseServings = recipe?.servings || 1;
  const scale = currentServings / baseServings;

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
            {(["meh", "good", "great"] as const).map((r) => (
              <button
                key={r}
                class={`rating-btn ${recipe.rating === r ? "active" : ""}`}
                onClick={() => handleRatingChange(r)}
              >
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>

          {wakeLock.isSupported && (
            <button
              class={`btn wake-lock-btn ${wakeLock.isActive ? "active" : ""}`}
              onClick={wakeLock.toggle}
            >
              {wakeLock.isActive ? "Screen On" : "Keep Awake"}
            </button>
          )}
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

        {recipe.servings && (
          <ScalingControls
            baseServings={baseServings}
            currentServings={currentServings}
            onServingsChange={setCurrentServings}
          />
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
                    {ing.quantity !== null
                      ? formatQuantity(ing.quantity, ing.unit, scale)
                      : ""}
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
                const renderedText = renderStepText(step.instruction, scale);

                return (
                  <li key={step.id} class="step-item">
                    <span class="step-number">{idx + 1}</span>
                    <div class="step-content">
                      <p>{renderedText}</p>
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

        {recipe.variants && recipe.variants.length > 0 && (
          <section class="recipe-section">
            <h2>Variants</h2>
            <ul>
              {recipe.variants.map((v) => (
                <li key={v.id}>
                  <a href={`/recipe/${v.id}`}>{v.title}</a>
                </li>
              ))}
            </ul>
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
    </div>
  );
}
