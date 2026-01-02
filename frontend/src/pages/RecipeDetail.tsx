interface Props {
  id?: string;
}

export function RecipeDetail({ id }: Props) {
  return (
    <div class="page">
      <header class="header">
        <a href="/" class="btn">
          Back
        </a>
        <h1>Recipe {id}</h1>
      </header>
      <main>
        <p>Recipe details will appear here.</p>
      </main>
    </div>
  );
}
