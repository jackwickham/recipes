import type { PortionVariantRef } from "@recipes/shared";

interface Props {
  currentServings: number;
  portionVariants: PortionVariantRef[];
  currentRecipeId: number;
  onNavigateToVariant: (recipeId: number) => void;
  onRequestNewPortion?: () => void;
}

export function PortionPicker({
  currentServings,
  portionVariants,
  currentRecipeId,
  onNavigateToVariant,
  onRequestNewPortion,
}: Props) {
  // If no variants, don't render anything
  if (!portionVariants || portionVariants.length === 0) {
    // Just show the current servings as a label
    if (currentServings) {
      return (
        <div class="portion-picker">
          <span class="portion-label">Portions:</span>
          <span class="portion-value">{currentServings}</span>
          {onRequestNewPortion && (
            <button
              class="portion-btn portion-add"
              onClick={onRequestNewPortion}
              title="Request a different portion size"
            >
              +
            </button>
          )}
        </div>
      );
    }
    return null;
  }

  // Sort variants by servings
  const sortedVariants = [...portionVariants].sort(
    (a, b) => a.servings - b.servings
  );

  // Check if current recipe is in the variants list
  const currentInVariants = sortedVariants.some(
    (v) => v.id === currentRecipeId
  );

  // Build the list of portions to show
  // If current is not in variants, add it (it's the parent)
  const allPortions = currentInVariants
    ? sortedVariants
    : [
        { id: currentRecipeId, servings: currentServings },
        ...sortedVariants,
      ].sort((a, b) => a.servings - b.servings);

  return (
    <div class="portion-picker">
      <span class="portion-label">Portions:</span>
      <div class="portion-buttons">
        {allPortions.map((variant) => (
          <button
            key={variant.id}
            class={`portion-btn ${variant.id === currentRecipeId ? "active" : ""}`}
            onClick={() => {
              if (variant.id !== currentRecipeId) {
                onNavigateToVariant(variant.id);
              }
            }}
            disabled={variant.id === currentRecipeId}
          >
            {variant.servings}
          </button>
        ))}
        {onRequestNewPortion && (
          <button
            class="portion-btn portion-add"
            onClick={onRequestNewPortion}
            title="Request a different portion size"
          >
            +
          </button>
        )}
      </div>
    </div>
  );
}
