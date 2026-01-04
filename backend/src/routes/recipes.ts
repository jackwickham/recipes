import { Router } from "express";
import {
  getAllRecipes,
  getRecipeById,
  createRecipe,
  createRecipeWithPortionVariants,
  updateRecipe,
  deleteRecipe,
  updateRecipeRating,
} from "../db/queries.js";
import type { ParsedRecipeWithVariants } from "@recipes/shared";
import { generateScaledRecipe } from "../services/recipe-parser.js";

export const recipesRouter = Router();

// GET /api/recipes - List all recipes
recipesRouter.get("/", (_req, res) => {
  const recipes = getAllRecipes();
  res.json(recipes);
});

// GET /api/recipes/:id - Get single recipe with full details
recipesRouter.get("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const recipe = getRecipeById(id);

  if (!recipe) {
    return res.status(404).json({ error: `Recipe ${id} not found` });
  }

  res.json(recipe);
});

// POST /api/recipes/:id/scale - Scale recipe to new servings
recipesRouter.post("/:id/scale", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { targetServings } = req.body;

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid recipe ID" });
  }

  if (!targetServings || typeof targetServings !== "number" || targetServings <= 0) {
    return res.status(400).json({ error: "Invalid target servings" });
  }

  const recipe = getRecipeById(id);
  if (!recipe) {
    return res.status(404).json({ error: `Recipe ${id} not found` });
  }

  try {
    const scaled = await generateScaledRecipe(recipe, targetServings);
    
    // Explicitly set the parentRecipeId and variantType for the frontend to use
    // This follows the same logic as the "fix" we just applied:
    // If original is a portion variant, parent is its parent.
    // Otherwise, parent is the original.
    const baseId =
      recipe.variantType === "portion" && recipe.parentRecipeId
        ? recipe.parentRecipeId
        : recipe.id;

    scaled.parentRecipeId = baseId;
    scaled.variantType = "portion";

    res.json(scaled);
  } catch (err) {
    console.error("Scaling error:", err);
    res.status(500).json({ error: "Failed to scale recipe" });
  }
});

// POST /api/recipes - Create new recipe
recipesRouter.post("/", (req, res) => {
  const id = createRecipe(req.body);
  const recipe = getRecipeById(id);
  res.status(201).json(recipe);
});

// POST /api/recipes/with-variants - Create recipe with portion variants
recipesRouter.post("/with-variants", (req, res) => {
  const { parsed, sourceType, sourceText, sourceContext } = req.body as {
    parsed: ParsedRecipeWithVariants;
    sourceType: "photo" | "url" | "text";
    sourceText: string | null;
    sourceContext: string | null;
  };

  if (!parsed || !Array.isArray(parsed.variants) || parsed.variants.length === 0) {
    return res.status(400).json({ error: "Invalid parsed recipe with variants" });
  }

  const ids = createRecipeWithPortionVariants(parsed, sourceType, sourceText, sourceContext);

  // Return the parent recipe with all details
  const recipe = getRecipeById(ids[0]);
  res.status(201).json({ recipe, allIds: ids });
});

// PUT /api/recipes/:id - Update recipe
recipesRouter.put("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = getRecipeById(id);

  if (!existing) {
    return res.status(404).json({ error: `Recipe ${id} not found` });
  }

  updateRecipe(id, req.body);
  const updated = getRecipeById(id);
  res.json(updated);
});

// DELETE /api/recipes/:id - Delete recipe
recipesRouter.delete("/:id", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = getRecipeById(id);

  if (!existing) {
    return res.status(404).json({ error: `Recipe ${id} not found` });
  }

  deleteRecipe(id);
  res.json({ deleted: id });
});

// PATCH /api/recipes/:id/rating - Update rating only
recipesRouter.patch("/:id/rating", (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { rating } = req.body;

  const existing = getRecipeById(id);
  if (!existing) {
    return res.status(404).json({ error: `Recipe ${id} not found` });
  }

  updateRecipeRating(id, rating);
  res.json({ id, rating });
});
