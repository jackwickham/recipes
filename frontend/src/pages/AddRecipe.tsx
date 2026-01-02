export function AddRecipe() {
  return (
    <div class="page">
      <header class="header">
        <a href="/" class="btn">
          Back
        </a>
        <h1>Add Recipe</h1>
      </header>
      <main class="add-recipe">
        <p>Choose how to add your recipe:</p>
        <div class="input-methods">
          <button class="btn btn-large">Take Photo</button>
          <button class="btn btn-large">Import from URL</button>
          <button class="btn btn-large">Paste Text</button>
        </div>
      </main>
    </div>
  );
}
