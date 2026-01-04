import type { ParsedRecipe } from "@recipes/shared";
import { renderStepText } from "../utils/scaling";

interface Props {
  recipe: ParsedRecipe;
  isOpen: boolean;
  onClose: () => void;
  onSave: (recipe: ParsedRecipe) => void;
  title?: string;
}

export function RecipePreviewModal({
  recipe,
  isOpen,
  onClose,
  onSave,
  title = "Preview Recipe",
}: Props) {
  if (!isOpen) return null;

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div class="modal-content" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>{title}</h2>
          <button class="btn btn-small" onClick={onClose}>
            ✕
          </button>
        </div>

        <div class="modal-body">
          <div class="recipe-detail" style="max-width: none; padding: 0;">
            {recipe.description && (
              <p class="recipe-description">{recipe.description}</p>
            )}

            <div class="recipe-meta">
              {recipe.servings && <span>Serves {recipe.servings}</span>}
              {recipe.prepTimeMinutes && (
                <span>Prep: {recipe.prepTimeMinutes}m</span>
              )}
              {recipe.cookTimeMinutes && (
                <span>Cook: {recipe.cookTimeMinutes}m</span>
              )}
            </div>

            {recipe.ingredients.length > 0 && (
              <section class="recipe-section">
                <h2>Ingredients</h2>
                <ul class="ingredient-list">
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i} class="ingredient-item">
                      <span class="ingredient-quantity" style="min-width: 60px;">
                        {ing.quantity && `${ing.quantity} `}
                        {ing.unit && `${ing.unit} `}
                      </span>
                      <span class="ingredient-name">
                        {ing.name}
                        {ing.notes && (
                          <span class="ingredient-notes"> ({ing.notes})</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {recipe.steps.length > 0 && (
              <section class="recipe-section">
                <h2>Method</h2>
                <ol class="step-list">
                  {recipe.steps.map((step, i) => {
                    const instruction =
                      typeof step === "string" ? step : step.instruction;
                    return (
                      <li key={i} class="step-item">
                        <span class="step-number">{i + 1}</span>
                        <div class="step-content">
                          <p>{renderStepText(instruction)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn" onClick={onClose}>
            Cancel
          </button>
          <button class="btn btn-primary" onClick={() => onSave(recipe)}>
            Save Variant
          </button>
        </div>
      </div>
    </div>
  );
}