import type { RecipeWithDetails } from "@recipes/shared";

interface Props {
  recipe: RecipeWithDetails;
}

function formatTime(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function getRatingColor(rating: string | null): string {
  switch (rating) {
    case "great":
      return "var(--color-success)";
    case "good":
      return "var(--color-warning)";
    case "meh":
      return "var(--color-text-secondary)";
    default:
      return "transparent";
  }
}

export function RecipeCard({ recipe }: Props) {
  const totalTime =
    (recipe.prepTimeMinutes || 0) + (recipe.cookTimeMinutes || 0);

  return (
    <a href={`/recipe/${recipe.id}`} class="recipe-card">
      <div class="recipe-card-header">
        <h3 class="recipe-card-title">{recipe.title}</h3>
        {recipe.rating && (
          <span
            class="recipe-card-rating"
            style={{ backgroundColor: getRatingColor(recipe.rating) }}
            title={recipe.rating}
          />
        )}
      </div>

      <div class="recipe-card-meta">
        {totalTime > 0 && <span>{formatTime(totalTime)}</span>}
        {recipe.servings && <span>{recipe.servings} servings</span>}
      </div>

      {recipe.tags.length > 0 && (
        <div class="recipe-card-tags">
          {recipe.tags.slice(0, 3).map((t) => (
            <span key={t.id} class="tag-chip">
              {t.tag}
            </span>
          ))}
        </div>
      )}
    </a>
  );
}
