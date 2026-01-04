import type {
  ParsedRecipe,
  ParsedRecipeResult,
  ParsedRecipeWithVariants,
  ParsedPortionVariant,
  IngredientInput,
  StepInput,
  hasVariants,
} from "@recipes/shared";
import { getLLM } from "./llm/index.js";

const RECIPE_PARSE_PROMPT = `You are a recipe parsing assistant. Extract the recipe from the provided text and return it as valid JSON.

IMPORTANT RULES:
1. Convert all measurements to metric units (grams, millilitres, celsius)
2. Convert oven temperatures to fan oven (typically 20°C lower than conventional)
3. Use British English ingredient names:
   - eggplant → aubergine
   - cilantro → coriander
   - zucchini → courgette
   - bell pepper → pepper
   - scallion/green onion → spring onion
   - arugula → rocket
   - shrimp → prawns
   - ground beef → beef mince
4. Mark timer durations with {{timer:M}} where M is minutes (e.g., {{timer:15}} for 15 minutes, {{timer:0.5}} for 30 seconds)
5. Suggest appropriate tags from: pasta, indian, mexican, asian, mediterranean, british, american, main, side, dessert, snack, breakfast, quick, vegetarian, vegan, one-pot, make-ahead, soup, salad, baking
6. SPLIT STEPS: Each step should focus on ONE main action. If a step contains multiple unrelated actions, split them into separate steps.
7. MULTIPLE PORTION SIZES: If the recipe provides quantities for multiple serving sizes (e.g., "For 2 people: 200g flour, For 4 people: 400g flour"), you MUST extract ALL variants using the multi-variant format below.

SINGLE SERVING FORMAT (when recipe has one serving size):
{
  "title": "Recipe Title",
  "description": "Brief description of the dish",
  "servings": 4,
  "prepTimeMinutes": 15,
  "cookTimeMinutes": 30,
  "ingredients": [
    {"name": "flour", "quantity": 500, "unit": "g", "notes": "sifted"},
    {"name": "eggs", "quantity": 3, "unit": null, "notes": null}
  ],
  "steps": [
    {"instruction": "Add 500g flour to a bowl."},
    {"instruction": "Beat 3 eggs and mix in. Cook for {{timer:5}}."}
  ],
  "suggestedTags": ["main", "quick", "vegetarian"]
}

MULTI-VARIANT FORMAT (when recipe has quantities for multiple serving sizes):
{
  "title": "Recipe Title",
  "description": "Brief description of the dish",
  "suggestedTags": ["main", "quick"],
  "variants": [
    {
      "servings": 2,
      "prepTimeMinutes": 15,
      "cookTimeMinutes": 30,
      "ingredients": [
        {"name": "flour", "quantity": 250, "unit": "g", "notes": null},
        {"name": "eggs", "quantity": 2, "unit": null, "notes": null}
      ],
      "steps": [
        {"instruction": "Add 250g flour to a bowl."},
        {"instruction": "Beat 2 eggs and mix in."}
      ]
    },
    {
      "servings": 4,
      "prepTimeMinutes": 15,
      "cookTimeMinutes": 35,
      "ingredients": [
        {"name": "flour", "quantity": 500, "unit": "g", "notes": null},
        {"name": "eggs", "quantity": 4, "unit": null, "notes": null}
      ],
      "steps": [
        {"instruction": "Add 500g flour to a bowl."},
        {"instruction": "Beat 4 eggs and mix in."}
      ]
    }
  ]
}

IMPORTANT: Use multi-variant format ONLY when the source recipe explicitly provides different quantities for different serving sizes. If it only gives one serving size, use the single format.

For ingredients:
- quantity should be a number or null (for "to taste", "a pinch", etc.)
- unit should be "g", "ml", "tsp", "tbsp", or null for countable items like "2 eggs"
- notes are optional (for prep instructions like "diced", "room temperature")

Parse this recipe:
`;

const RECIPE_GENERATE_PROMPT = `You are a creative recipe assistant. Generate a complete recipe based on the user's description.

IMPORTANT RULES:
1. Use metric units (grams, millilitres, celsius)
2. Use fan oven temperatures
3. Use British English ingredient names (aubergine not eggplant, coriander not cilantro, etc.)
4. Mark timer durations with {{timer:M}} where M is minutes (e.g., {{timer:15}} for 15 minutes, {{timer:0.5}} for 30 seconds)
5. Create practical, delicious recipes that a home cook can make
6. Be creative but realistic with ingredients and techniques
7. Suggest appropriate tags

Return ONLY valid JSON in this exact format:
{
  "title": "Recipe Title",
  "description": "Brief description of the dish",
  "servings": 4,
  "prepTimeMinutes": 15,
  "cookTimeMinutes": 30,
  "ingredients": [
    {"name": "flour", "quantity": 500, "unit": "g", "notes": "sifted"},
    {"name": "eggs", "quantity": 3, "unit": null, "notes": null}
  ],
  "steps": [
    {"instruction": "Add 500g flour to a bowl."},
    {"instruction": "Beat 3 eggs and mix in. Cook for {{timer:5}}."}
  ],
  "suggestedTags": ["main", "quick", "vegetarian"]
}

User's recipe request:
`;

const IMAGE_EXTRACT_PROMPT = `Extract all text from this recipe image. Include:
- Recipe title
- Any description or introduction
- All ingredients with quantities
- All cooking steps/method
- Any times, temperatures, or serving information

Return the text as if you were transcribing the recipe from a cookbook. Include all details visible in the image.`;

function extractJsonFromResponse(response: string): unknown {
  // Extract JSON from response (handle markdown code blocks)
  let jsonStr = response;
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    return JSON.parse(jsonStr);
  } catch {
    // Try to find JSON object in response
    const objectMatch = response.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      return JSON.parse(objectMatch[0]);
    }
    throw new Error("Failed to extract JSON from response");
  }
}

const SCALE_RECIPE_PROMPT = `You are a precise kitchen assistant. Scale the following recipe to {{servings}} servings.

IMPORTANT RULES:
1. Scale all ingredient quantities accurately based on the ratio between new and old servings.
2. Adjust cooking times only if necessary (e.g., a larger roast takes longer, but boiling pasta doesn't).
3. Return the complete recipe as valid JSON.
4. Keep the same title, description, and tags.

Return ONLY valid JSON in this exact format:
{
  "title": "Recipe Title",
  "description": "Brief description",
  "servings": {{servings}},
  "prepTimeMinutes": 15,
  "cookTimeMinutes": 30,
  "ingredients": [
    {"name": "flour", "quantity": 500, "unit": "g", "notes": "sifted"}
  ],
  "steps": [
    {"instruction": "Add 500g flour..."}
  ],
  "suggestedTags": ["tag1", "tag2"]
}

Original Recipe:
`;

export async function generateScaledRecipe(
  recipe: any, // Using any to avoid circular dependency on RecipeWithDetails if not available in this file context
  targetServings: number
): Promise<ParsedRecipe> {
  const recipeJson = JSON.stringify({
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    prepTimeMinutes: recipe.prepTimeMinutes,
    cookTimeMinutes: recipe.cookTimeMinutes,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    tags: recipe.tags
  }, null, 2);

  const prompt = SCALE_RECIPE_PROMPT.replace("{{servings}}", targetServings.toString())
    .replace("{{servings}}", targetServings.toString()) // Replace second occurrence in JSON example
    + recipeJson;

  const llm = getLLM();
  const response = await llm.complete(prompt);
  const parsed = extractJsonFromResponse(response);
  return validateParsedRecipe(parsed);
}

export async function generateRecipeFromPrompt(prompt: string): Promise<ParsedRecipe> {
  const llm = getLLM();
  const response = await llm.complete(RECIPE_GENERATE_PROMPT + prompt);
  const parsed = extractJsonFromResponse(response);
  const result = validateParsedRecipeResult(parsed);

  // Generate always returns single recipe, not variants
  if ("variants" in result) {
    throw new Error("Recipe generation should not return variants");
  }
  return result;
}

export async function parseRecipeFromText(text: string): Promise<ParsedRecipeResult> {
  const llm = getLLM();
  const response = await llm.complete(RECIPE_PARSE_PROMPT + text);
  const parsed = extractJsonFromResponse(response);
  return validateParsedRecipeResult(parsed);
}

export async function extractTextFromImage(imageBase64: string): Promise<string> {
  const llm = getLLM();
  return llm.completeWithImage(IMAGE_EXTRACT_PROMPT, imageBase64);
}

export async function parseRecipeFromImages(
  imagesBase64: string[]
): Promise<{ extractedText: string; recipe: ParsedRecipeResult }> {
  // Extract text from all images
  const textParts = await Promise.all(
    imagesBase64.map((img) => extractTextFromImage(img))
  );
  const extractedText = textParts.join("\n\n---\n\n");

  // Parse the combined text
  const recipe = await parseRecipeFromText(extractedText);

  return { extractedText, recipe };
}

export async function parseRecipeFromUrl(
  html: string
): Promise<{ extractedText: string; recipe: ParsedRecipeResult }> {
  // The HTML itself becomes the source text
  const recipe = await parseRecipeFromText(html);
  return { extractedText: html, recipe };
}

function validateIngredients(ingredients: unknown): IngredientInput[] {
  if (!Array.isArray(ingredients)) return [];
  return ingredients.map((ing: Record<string, unknown>) => ({
    name: String(ing.name || ""),
    quantity: typeof ing.quantity === "number" ? ing.quantity : null,
    unit: typeof ing.unit === "string" ? ing.unit : null,
    notes: typeof ing.notes === "string" ? ing.notes : null,
  }));
}

function validateSteps(steps: unknown): StepInput[] {
  if (!Array.isArray(steps)) return [];
  return steps.map((step: unknown) => {
    if (typeof step === "string") {
      return { instruction: step };
    }
    const stepObj = step as Record<string, unknown>;
    return { instruction: String(stepObj.instruction || "") };
  });
}

function validateTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((t): t is string => typeof t === "string");
}

function validateParsedRecipeResult(data: unknown): ParsedRecipeResult {
  const recipe = data as Record<string, unknown>;

  if (!recipe.title || typeof recipe.title !== "string") {
    throw new Error("Recipe must have a title");
  }

  // Check if this is a multi-variant recipe
  if (Array.isArray(recipe.variants) && recipe.variants.length > 0) {
    const variants: ParsedPortionVariant[] = recipe.variants.map(
      (v: Record<string, unknown>) => ({
        servings: typeof v.servings === "number" ? v.servings : 1,
        prepTimeMinutes:
          typeof v.prepTimeMinutes === "number" ? v.prepTimeMinutes : null,
        cookTimeMinutes:
          typeof v.cookTimeMinutes === "number" ? v.cookTimeMinutes : null,
        ingredients: validateIngredients(v.ingredients),
        steps: validateSteps(v.steps),
      })
    );

    return {
      title: recipe.title,
      description:
        typeof recipe.description === "string" ? recipe.description : null,
      suggestedTags: validateTags(recipe.suggestedTags),
      variants,
    } as ParsedRecipeWithVariants;
  }

  // Single recipe format
  return {
    title: recipe.title,
    description:
      typeof recipe.description === "string" ? recipe.description : null,
    servings: typeof recipe.servings === "number" ? recipe.servings : null,
    prepTimeMinutes:
      typeof recipe.prepTimeMinutes === "number"
        ? recipe.prepTimeMinutes
        : null,
    cookTimeMinutes:
      typeof recipe.cookTimeMinutes === "number"
        ? recipe.cookTimeMinutes
        : null,
    ingredients: validateIngredients(recipe.ingredients),
    steps: validateSteps(recipe.steps),
    suggestedTags: validateTags(recipe.suggestedTags),
  } as ParsedRecipe;
}

// Keep the old function for backwards compatibility where only ParsedRecipe is expected
function validateParsedRecipe(data: unknown): ParsedRecipe {
  const result = validateParsedRecipeResult(data);
  if ("variants" in result) {
    throw new Error("Expected single recipe but got variants");
  }
  return result;
}
