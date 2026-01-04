import type { ParsedRecipe } from "@recipes/shared";
import { renderStepText } from "../utils/scaling";

interface Props {
  recipe: ParsedRecipe;
  isOpen: boolean;
  onClose: () => void;
  onSaveAsNew: (recipe: ParsedRecipe) => void;
  onSaveAsVariant: (recipe: ParsedRecipe) => void;
  onReplaceRecipe: (recipe: ParsedRecipe) => void;
  title?: string;
}

export function RecipePreviewModal({
  recipe,
  isOpen,
  onClose,
  onSaveAsNew,
  onSaveAsVariant,
  onReplaceRecipe,
  title = "Preview Recipe",
}: Props) {
  if (!isOpen) return null;

  return (
    <div class="modal-overlay" onClick={onClose}>
      <div class="modal-content recipe-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div class="modal-header">
          <h2>{title}</h2>
          <button class="btn btn-small" onClick={onClose}>
            Close
          </button>
        </div>

        <div class="modal-body">
          <div class="chat-recipe-preview">
            <h3>{recipe.title}</h3>
            {recipe.description && (
              <p class="chat-recipe-description">{recipe.description}</p>
            )}

            <div class="chat-recipe-meta">
              {recipe.servings && <span>Serves {recipe.servings}</span>}
              {recipe.prepTimeMinutes && (
                <span>Prep: {recipe.prepTimeMinutes}m</span>
              )}
              {recipe.cookTimeMinutes && (
                <span>Cook: {recipe.cookTimeMinutes}m</span>
              )}
            </div>

            {recipe.ingredients.length > 0 && (
              <div class="chat-recipe-section">
                <h4>Ingredients</h4>
                <ul>
                  {recipe.ingredients.map((ing, i) => (
                    <li key={i}>
                      {ing.quantity && `${ing.quantity} `}
                      {ing.unit && `${ing.unit} `}
                      {ing.name}
                      {ing.notes && ` (${ing.notes})`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {recipe.steps.length > 0 && (
              <div class="chat-recipe-section">
                <h4>Method</h4>
                <ol>
                  {recipe.steps.map((step, i) => {
                    const instruction = typeof step === 'string' ? step : step.instruction;
                    return <li key={i}>{renderStepText(instruction)}</li>;
                  })}
                </ol>
              </div>
            )}

            {(recipe.suggestedTags || []).length > 0 && (
              <div class="chat-recipe-tags">
                {(recipe.suggestedTags || []).map((tag) => (
                  <span key={tag} class="tag-chip">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div class="modal-footer">
          <div class="chat-recipe-actions">
            <button
              class="btn btn-primary"
              onClick={() => onSaveAsVariant(recipe)}
            >
              Save as Variant
            </button>
            <button
              class="btn"
              onClick={() => onSaveAsNew(recipe)}
            >
              Save as New
            </button>
            <button
              class="btn btn-danger"
              onClick={() => onReplaceRecipe(recipe)}
            >
              Replace Original
            </button>
            <button class="btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
