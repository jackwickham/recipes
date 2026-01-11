import { useState, useRef, useCallback } from "preact/hooks";
import { route } from "preact-router";
import { RecipeForm } from "../components/RecipeForm";
import {
  createRecipe,
  queueImportFromUrl,
  queueImportFromPhotos,
  queueImportFromText,
  type ImportProgress,
} from "../api/client";
import type { CreateRecipeInput } from "@recipes/shared";

type Mode = "choose" | "manual" | "photo" | "url" | "text";

export function AddRecipe({ path }: { path?: string }) {
  const [mode, setMode] = useState<Mode>("choose");
  const [error, setError] = useState<string | null>(null);

  // URL import state
  const [urlInput, setUrlInput] = useState("");
  const [urlProgress, setUrlProgress] = useState<ImportProgress | null>(null);

  // Text import state
  const [textInput, setTextInput] = useState("");
  const [textProgress, setTextProgress] = useState<ImportProgress | null>(null);

  // Photo import state
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoProgress, setPhotoProgress] = useState<ImportProgress | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track current import generation to ignore stale callbacks
  const importGeneration = useRef(0);

  async function handleSubmit(data: CreateRecipeInput) {
    const recipe = await createRecipe(data);
    route(`/recipe/${recipe.id}`);
  }

  function handleImportFromUrl() {
    if (!urlInput.trim()) {
      setError("Please enter a URL");
      return;
    }

    setError(null);
    setUrlProgress({ stage: "fetching", message: "Starting..." });

    const gen = importGeneration.current;
    queueImportFromUrl(
      urlInput.trim(),
      (progress) => {
        if (importGeneration.current === gen) setUrlProgress(progress);
      },
      () => {
        // Import complete - clear progress if still current, recipe is saved
        if (importGeneration.current === gen) {
          setUrlProgress(null);
          setUrlInput("");
        }
      },
      (errorMsg) => {
        if (importGeneration.current === gen) {
          setUrlProgress(null);
          setError(errorMsg);
        }
      }
    );
  }

  function handleImportFromText() {
    if (!textInput.trim()) {
      setError("Please enter some recipe text");
      return;
    }

    setError(null);
    setTextProgress({ stage: "parsing", message: "Starting..." });

    const gen = importGeneration.current;
    queueImportFromText(
      textInput.trim(),
      (progress) => {
        if (importGeneration.current === gen) setTextProgress(progress);
      },
      () => {
        // Import complete - clear progress if still current, recipe is saved
        if (importGeneration.current === gen) {
          setTextProgress(null);
          setTextInput("");
        }
      },
      (errorMsg) => {
        if (importGeneration.current === gen) {
          setTextProgress(null);
          setError(errorMsg);
        }
      }
    );
  }

  function handlePhotoSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files?.length) return;

    const newPhotos: string[] = [];
    const readers: Promise<void>[] = [];

    for (const file of Array.from(input.files)) {
      const reader = new FileReader();
      readers.push(
        new Promise((resolve) => {
          reader.onload = () => {
            if (typeof reader.result === "string") {
              newPhotos.push(reader.result);
            }
            resolve();
          };
          reader.readAsDataURL(file);
        })
      );
    }

    Promise.all(readers).then(() => {
      setPhotos((prev) => [...prev, ...newPhotos]);
    });

    input.value = "";
  }

  function removePhoto(index: number) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function handleImportFromPhotos() {
    if (photos.length === 0) {
      setError("Please add at least one photo");
      return;
    }

    setError(null);
    setPhotoProgress({ stage: "extracting", message: "Starting..." });

    const gen = importGeneration.current;
    queueImportFromPhotos(
      photos,
      (progress) => {
        if (importGeneration.current === gen) setPhotoProgress(progress);
      },
      () => {
        // Import complete - clear progress if still current, recipe is saved
        if (importGeneration.current === gen) {
          setPhotoProgress(null);
          setPhotos([]);
        }
      },
      (errorMsg) => {
        if (importGeneration.current === gen) {
          setPhotoProgress(null);
          setError(errorMsg);
        }
      }
    );
  }

  function handleBack() {
    setMode("choose");
    setError(null);
  }

  function handleImportAnother() {
    // Increment generation to ignore callbacks from previous import
    importGeneration.current += 1;
    // Reset the form for another import (current import continues in background)
    setUrlInput("");
    setUrlProgress(null);
    setTextInput("");
    setTextProgress(null);
    setPhotos([]);
    setPhotoProgress(null);
    setError(null);
    setMode("choose");
  }

  // Manual entry
  if (mode === "manual") {
    return (
      <div class="page">
        <header class="header">
          <button class="btn" onClick={handleBack}>
            Back
          </button>
          <h1>Add Recipe Manually</h1>
        </header>
        <main>
          <RecipeForm
            onSubmit={handleSubmit}
            onCancel={handleBack}
            submitLabel="Create Recipe"
          />
        </main>
      </div>
    );
  }

  // Photo import
  if (mode === "photo") {
    const isProcessing = photoProgress !== null;

    return (
      <div class="page">
        <header class="header">
          {!isProcessing && (
            <button class="btn" onClick={handleBack}>
              Back
            </button>
          )}
          <h1>Import from Photo</h1>
        </header>
        <main>
          {error && <p class="error">{error}</p>}

          {!isProcessing && (
            <>
              <div class="form-group">
                <label>Photos</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoSelect}
                  style="display: none"
                />
                <button
                  class="btn"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Add Photos
                </button>
              </div>

              {photos.length > 0 && (
                <div class="photo-grid">
                  {photos.map((photo, idx) => (
                    <div key={idx} class="photo-preview">
                      <img src={photo} alt={`Photo ${idx + 1}`} />
                      <button
                        class="photo-remove"
                        onClick={() => removePhoto(idx)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {isProcessing ? (
            <div class="import-progress">
              <div class="import-spinner" />
              <div class="import-progress-message">{photoProgress.message}</div>
              <button class="btn" onClick={handleImportAnother}>
                Import Another
              </button>
            </div>
          ) : (
            <div class="form-actions">
              <button class="btn" onClick={handleBack}>
                Cancel
              </button>
              <button
                class="btn btn-primary"
                onClick={handleImportFromPhotos}
                disabled={photos.length === 0}
              >
                Extract Recipe
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  // URL import
  if (mode === "url") {
    const isProcessing = urlProgress !== null;

    return (
      <div class="page">
        <header class="header">
          {!isProcessing && (
            <button class="btn" onClick={handleBack}>
              Back
            </button>
          )}
          <h1>Import from URL</h1>
        </header>
        <main>
          {error && <p class="error">{error}</p>}

          {!isProcessing && (
            <>
              <div class="form-group">
                <label for="url-input">Recipe URL</label>
                <input
                  id="url-input"
                  type="url"
                  value={urlInput}
                  onInput={(e) => setUrlInput(e.currentTarget.value)}
                  placeholder="https://example.com/recipe"
                />
              </div>

              <div class="form-actions">
                <button class="btn" onClick={handleBack}>
                  Cancel
                </button>
                <button
                  class="btn btn-primary"
                  onClick={handleImportFromUrl}
                  disabled={!urlInput.trim()}
                >
                  Import Recipe
                </button>
              </div>
            </>
          )}

          {isProcessing && (
            <div class="import-progress">
              <div class="import-spinner" />
              <div class="import-progress-message">{urlProgress.message}</div>
              <button class="btn" onClick={handleImportAnother}>
                Import Another
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Text import
  if (mode === "text") {
    const isProcessing = textProgress !== null;

    return (
      <div class="page">
        <header class="header">
          {!isProcessing && (
            <button class="btn" onClick={handleBack}>
              Back
            </button>
          )}
          <h1>Import from Text</h1>
        </header>
        <main>
          {error && <p class="error">{error}</p>}

          {!isProcessing && (
            <>
              <div class="form-group">
                <label for="text-input">Paste recipe text</label>
                <textarea
                  id="text-input"
                  value={textInput}
                  onInput={(e) => setTextInput(e.currentTarget.value)}
                  placeholder="Paste the recipe text here..."
                  rows={12}
                />
              </div>

              <div class="form-actions">
                <button class="btn" onClick={handleBack}>
                  Cancel
                </button>
                <button
                  class="btn btn-primary"
                  onClick={handleImportFromText}
                  disabled={!textInput.trim()}
                >
                  Process Recipe
                </button>
              </div>
            </>
          )}

          {isProcessing && (
            <div class="import-progress">
              <div class="import-spinner" />
              <div class="import-progress-message">{textProgress.message}</div>
              <button class="btn" onClick={handleImportAnother}>
                Import Another
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Choose method
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
