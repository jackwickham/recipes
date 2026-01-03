import { useCookingList } from "../hooks/useCookingList";

export function CookingList({ path }: { path?: string }) {
  const { items, removeRecipe, clearList } = useCookingList();

  return (
    <div class="page">
      <header class="header">
        <a href="/" class="btn">
          Back
        </a>
        <h1>Cooking List</h1>
        {items.length > 0 && (
          <div class="header-actions">
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
          <ul class="cooking-list">
            {items.map((item) => (
              <li key={item.id} class="cooking-list-item">
                <a href={`/recipe/${item.id}`} class="cooking-list-link">
                  {item.title}
                </a>
                <button
                  class="btn btn-small"
                  onClick={() => removeRecipe(item.id)}
                  title="Remove from list"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
