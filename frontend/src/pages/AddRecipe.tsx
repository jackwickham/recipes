import { useState } from "preact/hooks";
import { route } from "preact-router";
import { RecipeForm } from "../components/RecipeForm";
import { createRecipe } from "../api/client";
import type { CreateRecipeInput } from "@recipes/shared";

type Mode = "choose" | "manual" | "photo" | "url" | "text";

export function AddRecipe() {
  const [mode, setMode] = useState<Mode>("choose");

  async function handleSubmit(data: CreateRecipeInput) {
    const recipe = await createRecipe(data);
    route(`/recipe/${recipe.id}`);
  }

  if (mode === "manual") {
    return (
      <div class="page">
        <header class="header">
          <button class="btn" onClick={() => setMode("choose")}>
            Back
          </button>
          <h1>Add Recipe Manually</h1>
        </header>
        <main>
          <RecipeForm
            onSubmit={handleSubmit}
            onCancel={() => setMode("choose")}
            submitLabel="Create Recipe"
          />
        </main>
      </div>
    );
  }

  if (mode === "photo") {
    return (
      <div class="page">
        <header class="header">
          <button class="btn" onClick={() => setMode("choose")}>
            Back
          </button>
          <h1>Import from Photo</h1>
        </header>
        <main>
          <p class="placeholder-message">
            Photo import will be available once LLM integration is complete
            (Phase 3).
          </p>
          <button class="btn" onClick={() => setMode("choose")}>
            Go Back
          </button>
        </main>
      </div>
    );
  }

  if (mode === "url") {
    return (
      <div class="page">
        <header class="header">
          <button class="btn" onClick={() => setMode("choose")}>
            Back
          </button>
          <h1>Import from URL</h1>
        </header>
        <main>
          <p class="placeholder-message">
            URL import will be available once LLM integration is complete (Phase
            3).
          </p>
          <button class="btn" onClick={() => setMode("choose")}>
            Go Back
          </button>
        </main>
      </div>
    );
  }

  if (mode === "text") {
    return (
      <div class="page">
        <header class="header">
          <button class="btn" onClick={() => setMode("choose")}>
            Back
          </button>
          <h1>Import from Text</h1>
        </header>
        <main>
          <p class="placeholder-message">
            Text import will be available once LLM integration is complete
            (Phase 3).
          </p>
          <button class="btn" onClick={() => setMode("choose")}>
            Go Back
          </button>
        </main>
      </div>
    );
  }

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
          <button class="btn btn-large" onClick={() => setMode("photo")}>
            Take Photo
          </button>
          <button class="btn btn-large" onClick={() => setMode("url")}>
            Import from URL
          </button>
          <button class="btn btn-large" onClick={() => setMode("text")}>
            Paste Text
          </button>
          <button
            class="btn btn-large btn-primary"
            onClick={() => setMode("manual")}
          >
            Enter Manually
          </button>
        </div>
      </main>
    </div>
  );
}
