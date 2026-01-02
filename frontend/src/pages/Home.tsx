export function Home() {
  return (
    <div class="page">
      <header class="header">
        <h1>Recipes</h1>
        <a href="/add" class="btn btn-primary">
          Add Recipe
        </a>
      </header>
      <main>
        <p>No recipes yet. Add your first recipe to get started!</p>
      </main>
    </div>
  );
}
