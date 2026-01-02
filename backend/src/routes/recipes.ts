import { Router } from "express";
import {
  getAllRecipes,
  getRecipeById,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  updateRecipeRating,
} from "../db/queries.js";

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

// POST /api/recipes - Create new recipe
recipesRouter.post("/", (req, res) => {
  const id = createRecipe(req.body);
  const recipe = getRecipeById(id);
  res.status(201).json(recipe);
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
