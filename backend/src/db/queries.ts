import { getDb } from "./index.js";
import type {
  Recipe,
  Ingredient,
  Step,
  Tag,
  RecipeWithDetails,
  RecipeRef,
  CreateRecipeInput,
  PortionVariantRef,
  ParsedRecipeWithVariants,
  VariantType,
} from "@recipes/shared";

// Recipe queries

export function getAllRecipes(): RecipeWithDetails[] {
  const db = getDb();

  // Only get parent recipes (not variants) for the main list
  const recipes = db
    .prepare(
      `
    SELECT
      id, title, description, servings,
      prep_time_minutes as prepTimeMinutes,
      cook_time_minutes as cookTimeMinutes,
      rating, source_type as sourceType,
      source_text as sourceText,
      source_context as sourceContext,
      parent_recipe_id as parentRecipeId,
      variant_type as variantType,
      created_at as createdAt,
      updated_at as updatedAt
    FROM recipes
    WHERE parent_recipe_id IS NULL
    ORDER BY created_at DESC
  `
    )
    .all() as Recipe[];

  return recipes.map((recipe) => ({
    ...recipe,
    ingredients: getIngredientsByRecipeId(recipe.id),
    steps: getStepsByRecipeId(recipe.id),
    tags: getTagsByRecipeId(recipe.id),
    portionVariants: getPortionVariants(recipe.id),
  }));
}

export function getRecipeById(id: number): RecipeWithDetails | null {
  const db = getDb();

  const recipe = db
    .prepare(
      `
    SELECT
      id, title, description, servings,
      prep_time_minutes as prepTimeMinutes,
      cook_time_minutes as cookTimeMinutes,
      rating, source_type as sourceType,
      source_text as sourceText,
      source_context as sourceContext,
      parent_recipe_id as parentRecipeId,
      variant_type as variantType,
      created_at as createdAt,
      updated_at as updatedAt
    FROM recipes
    WHERE id = ?
  `
    )
    .get(id) as Recipe | undefined;

  if (!recipe) return null;

  // Get content variants (non-portion variants)
  const contentVariants = db
    .prepare(
      `
    SELECT
      id, title, description, servings,
      prep_time_minutes as prepTimeMinutes,
      cook_time_minutes as cookTimeMinutes,
      rating, source_type as sourceType,
      source_text as sourceText,
      source_context as sourceContext,
      parent_recipe_id as parentRecipeId,
      variant_type as variantType,
      created_at as createdAt,
      updated_at as updatedAt
    FROM recipes
    WHERE parent_recipe_id = ? AND (variant_type = 'content' OR variant_type IS NULL)
  `
    )
    .all(id) as Recipe[];

  // Get parent recipe info if this is a variant
  let parentRecipe: RecipeRef | undefined;
  if (recipe.parentRecipeId) {
    const parent = db
      .prepare("SELECT id, title FROM recipes WHERE id = ?")
      .get(recipe.parentRecipeId) as RecipeRef | undefined;
    parentRecipe = parent;
  }

  // Get portion variants - either children of this recipe or siblings (if this is a portion variant)
  let portionVariants: PortionVariantRef[];
  if (recipe.variantType === "portion" && recipe.parentRecipeId) {
    // This is a portion variant - get siblings including parent
    portionVariants = getPortionVariantsWithParent(recipe.parentRecipeId);
  } else {
    // This is a parent recipe - get portion variant children
    portionVariants = getPortionVariants(id);
  }

  return {
    ...recipe,
    ingredients: getIngredientsByRecipeId(id),
    steps: getStepsByRecipeId(id),
    tags: getTagsByRecipeId(id),
    portionVariants,
    contentVariants: contentVariants.length > 0 ? contentVariants : undefined,
    parentRecipe,
  };
}

export function createRecipe(input: CreateRecipeInput): number {
  const db = getDb();

  const result = db
    .prepare(
      `
    INSERT INTO recipes (
      title, description, servings, prep_time_minutes, cook_time_minutes,
      rating, source_type, source_text, source_context, parent_recipe_id, variant_type
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      input.title,
      input.description ?? null,
      input.servings ?? null,
      input.prepTimeMinutes ?? null,
      input.cookTimeMinutes ?? null,
      input.rating ?? null,
      input.sourceType,
      input.sourceText ?? null,
      input.sourceContext ?? null,
      input.parentRecipeId ?? null,
      input.variantType ?? null
    );

  const recipeId = result.lastInsertRowid as number;

  // Insert ingredients
  if (input.ingredients?.length) {
    const insertIngredient = db.prepare(`
      INSERT INTO ingredients (recipe_id, position, name, quantity, unit, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    input.ingredients.forEach((ing, idx) => {
      insertIngredient.run(
        recipeId,
        idx,
        ing.name,
        ing.quantity ?? null,
        ing.unit ?? null,
        ing.notes ?? null
      );
    });
  }

  // Insert steps
  if (input.steps?.length) {
    const insertStep = db.prepare(`
      INSERT INTO steps (recipe_id, position, instruction)
      VALUES (?, ?, ?)
    `);

    input.steps.forEach((step, idx) => {
      insertStep.run(recipeId, idx, step.instruction);
    });
  }

  // Insert tags
  if (input.tags?.length) {
    const insertTag = db.prepare(`
      INSERT INTO tags (recipe_id, tag, is_auto_generated)
      VALUES (?, ?, ?)
    `);

    input.tags.forEach((tag) => {
      insertTag.run(recipeId, tag.tag, tag.isAutoGenerated ? 1 : 0);
    });
  }

  return recipeId;
}

export function updateRecipe(
  id: number,
  input: Partial<CreateRecipeInput>
): void {
  const db = getDb();

  const updates: string[] = [];
  const values: unknown[] = [];

  if (input.title !== undefined) {
    updates.push("title = ?");
    values.push(input.title);
  }
  if (input.description !== undefined) {
    updates.push("description = ?");
    values.push(input.description);
  }
  if (input.servings !== undefined) {
    updates.push("servings = ?");
    values.push(input.servings);
  }
  if (input.prepTimeMinutes !== undefined) {
    updates.push("prep_time_minutes = ?");
    values.push(input.prepTimeMinutes);
  }
  if (input.cookTimeMinutes !== undefined) {
    updates.push("cook_time_minutes = ?");
    values.push(input.cookTimeMinutes);
  }
  if (input.rating !== undefined) {
    updates.push("rating = ?");
    values.push(input.rating);
  }
  if (input.sourceContext !== undefined) {
    updates.push("source_context = ?");
    values.push(input.sourceContext);
  }

  if (updates.length > 0) {
    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(id);

    db.prepare(`UPDATE recipes SET ${updates.join(", ")} WHERE id = ?`).run(
      ...values
    );
  }

  // Update ingredients if provided
  if (input.ingredients) {
    db.prepare("DELETE FROM ingredients WHERE recipe_id = ?").run(id);

    const insertIngredient = db.prepare(`
      INSERT INTO ingredients (recipe_id, position, name, quantity, unit, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    input.ingredients.forEach((ing, idx) => {
      insertIngredient.run(
        id,
        idx,
        ing.name,
        ing.quantity ?? null,
        ing.unit ?? null,
        ing.notes ?? null
      );
    });
  }

  // Update steps if provided
  if (input.steps) {
    db.prepare("DELETE FROM steps WHERE recipe_id = ?").run(id);

    const insertStep = db.prepare(`
      INSERT INTO steps (recipe_id, position, instruction)
      VALUES (?, ?, ?)
    `);

    input.steps.forEach((step, idx) => {
      insertStep.run(id, idx, step.instruction);
    });
  }

  // Update tags if provided
  if (input.tags) {
    db.prepare("DELETE FROM tags WHERE recipe_id = ?").run(id);

    const insertTag = db.prepare(`
      INSERT INTO tags (recipe_id, tag, is_auto_generated)
      VALUES (?, ?, ?)
    `);

    input.tags.forEach((tag) => {
      insertTag.run(id, tag.tag, tag.isAutoGenerated ? 1 : 0);
    });
  }
}

export function deleteRecipe(id: number): void {
  const db = getDb();
  // Delete all variants first (recipes that have this as their parent)
  db.prepare("DELETE FROM recipes WHERE parent_recipe_id = ?").run(id);
  // Then delete the recipe itself
  db.prepare("DELETE FROM recipes WHERE id = ?").run(id);
}

export function updateRecipeRating(
  id: number,
  rating: "meh" | "good" | "great" | null
): void {
  const db = getDb();
  db.prepare(
    "UPDATE recipes SET rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(rating, id);
}

// Helper functions

function getIngredientsByRecipeId(recipeId: number): Ingredient[] {
  const db = getDb();
  return db
    .prepare(
      `
    SELECT id, recipe_id as recipeId, position, name, quantity, unit, notes
    FROM ingredients
    WHERE recipe_id = ?
    ORDER BY position
  `
    )
    .all(recipeId) as Ingredient[];
}

function getStepsByRecipeId(recipeId: number): Step[] {
  const db = getDb();
  return db
    .prepare(
      `
    SELECT id, recipe_id as recipeId, position, instruction
    FROM steps
    WHERE recipe_id = ?
    ORDER BY position
  `
    )
    .all(recipeId) as Step[];
}

function getTagsByRecipeId(recipeId: number): Tag[] {
  const db = getDb();
  return db
    .prepare(
      `
    SELECT id, recipe_id as recipeId, tag, is_auto_generated as isAutoGenerated
    FROM tags
    WHERE recipe_id = ?
  `
    )
    .all(recipeId) as Tag[];
}

// Get portion variants for a parent recipe (children with variant_type = 'portion')
function getPortionVariants(parentRecipeId: number): PortionVariantRef[] {
  const db = getDb();
  return db
    .prepare(
      `
    SELECT id, servings
    FROM recipes
    WHERE parent_recipe_id = ? AND variant_type = 'portion'
    ORDER BY servings
  `
    )
    .all(parentRecipeId) as PortionVariantRef[];
}

// Get portion variants including the parent recipe itself (for sibling lookup)
function getPortionVariantsWithParent(
  parentRecipeId: number
): PortionVariantRef[] {
  const db = getDb();

  // Get the parent's servings
  const parent = db
    .prepare("SELECT id, servings FROM recipes WHERE id = ?")
    .get(parentRecipeId) as PortionVariantRef | undefined;

  // Get all portion variant children
  const variants = getPortionVariants(parentRecipeId);

  // Include parent in the list if it has servings
  if (parent && parent.servings) {
    return [parent, ...variants].sort(
      (a, b) => (a.servings ?? 0) - (b.servings ?? 0)
    );
  }

  return variants;
}

// Create multiple portion variants from a parsed recipe with variants
export function createRecipeWithPortionVariants(
  parsed: ParsedRecipeWithVariants,
  sourceType: "photo" | "url" | "text",
  sourceText: string | null,
  sourceContext: string | null
): number[] {
  const db = getDb();
  const createdIds: number[] = [];

  // Sort variants by servings - smallest becomes the parent
  const sortedVariants = [...parsed.variants].sort(
    (a, b) => a.servings - b.servings
  );

  // Create the first variant as the parent recipe
  const firstVariant = sortedVariants[0];
  const parentId = createRecipe({
    title: parsed.title,
    description: parsed.description,
    servings: firstVariant.servings,
    prepTimeMinutes: firstVariant.prepTimeMinutes,
    cookTimeMinutes: firstVariant.cookTimeMinutes,
    sourceType,
    sourceText,
    sourceContext,
    ingredients: firstVariant.ingredients,
    steps: firstVariant.steps,
    tags: parsed.suggestedTags.map((tag) => ({
      tag,
      isAutoGenerated: true,
    })),
  });
  createdIds.push(parentId);

  // Create remaining variants as portion variants linked to parent
  for (let i = 1; i < sortedVariants.length; i++) {
    const variant = sortedVariants[i];
    const variantId = createRecipe({
      title: parsed.title,
      description: parsed.description,
      servings: variant.servings,
      prepTimeMinutes: variant.prepTimeMinutes,
      cookTimeMinutes: variant.cookTimeMinutes,
      sourceType,
      sourceText,
      sourceContext,
      parentRecipeId: parentId,
      variantType: "portion",
      ingredients: variant.ingredients,
      steps: variant.steps,
      tags: parsed.suggestedTags.map((tag) => ({
        tag,
        isAutoGenerated: true,
      })),
    });
    createdIds.push(variantId);
  }

  return createdIds;
}

// Tag queries

// Default tags to seed the database with - these represent common recipe categories
export const DEFAULT_TAGS = [
  // Cuisine types
  "british",
  "american",
  "indian",
  "mexican",
  "asian",
  "mediterranean",
  "italian",
  "french",
  "middle-eastern",
  "thai",
  "chinese",
  "japanese",
  // Meal types
  "breakfast",
  "lunch",
  "dinner",
  "main",
  "side",
  "dessert",
  "snack",
  "starter",
  // Dish types
  "soup",
  "salad",
  "pasta",
  "curry",
  "stir-fry",
  "roast",
  "baking",
  // Characteristics
  "quick",
];

export function getAllTags(): string[] {
  const db = getDb();
  const result = db
    .prepare(
      `
    SELECT DISTINCT tag FROM tags ORDER BY tag
  `
    )
    .all() as { tag: string }[];

  return result.map((r) => r.tag);
}

/**
 * Get all existing tags, falling back to default tags if none exist.
 * This is used for LLM prompts to encourage consistent tag usage.
 */
export function getTagsForPrompt(): string[] {
  const existingTags = getAllTags();
  if (existingTags.length > 0) {
    return existingTags;
  }
  return DEFAULT_TAGS;
}
