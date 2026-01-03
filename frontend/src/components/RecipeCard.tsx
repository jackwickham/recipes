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

function getRatingContent(rating: string | null) {
  switch (rating) {
    case "great":
      return (
        <span class="thumbs-double">
          <span class="thumb-back">👍</span>
          <span class="thumb-front">👍</span>
        </span>
      );
    case "good":
      return "👍";
    case "meh":
      return "👎";
    default:
      return null;
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
            class={`recipe-card-rating rating-${recipe.rating}`}
            title={recipe.rating}
          >
            {getRatingContent(recipe.rating)}
          </span>
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
