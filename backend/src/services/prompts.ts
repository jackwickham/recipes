import type { RecipeWithDetails } from "@recipes/shared";

/**
 * Prompt fragments shared by every recipe-producing flow.
 *
 * Output structure is enforced by the JSON Schema derived from the zod schemas in
 * `@recipes/shared`, so these prompts only carry house style and task framing -
 * they deliberately contain no JSON examples.
 */

const HOUSE_STYLE = `Follow these conventions in every recipe:
- Use metric units throughout (grams, millilitres, celsius).
- Give oven temperatures for a fan oven, typically 20°C below a conventional oven.
- Use British English ingredient names: aubergine not eggplant, coriander not cilantro.
- Mark durations inside step instructions with {{timer:M}}, where M is the number of minutes.`;

function tagGuidance(existingTags: string[]): string {
  return `Prefer these existing tags where one fits: ${existingTags.join(", ")}.
Create a new tag only when none of them describes the dish.`;
}

export function recipeParsePrompt(existingTags: string[]): string {
  return `You are a recipe parsing assistant. Extract the recipe from the text the user provides, converting it to the conventions below. Extract only what the source says; do not invent quantities or steps.

${HOUSE_STYLE}

${tagGuidance(existingTags)}

Most sources describe a single serving size, which you should return as one variant. Return several variants only when the source explicitly lists different quantities for different serving sizes, and then give each one exactly the quantities the source states.`;
}

export function recipeGeneratePrompt(existingTags: string[]): string {
  return `You are a creative recipe assistant. Write a complete, practical recipe matching the user's description. Be imaginative but realistic about ingredients and techniques a home cook can manage.

${HOUSE_STYLE}

${tagGuidance(existingTags)}`;
}

export function recipeScalePrompt(
  targetServings: number,
  existingTags: string[]
): string {
  return `You are a precise kitchen assistant. Rewrite the recipe the user provides so it serves ${targetServings}.

Scale quantities by the ratio between the new and old serving counts, using judgement about what should actually scale and how it should round: seasonings, raising agents and pan-coating fats rarely scale linearly. Adjust cooking times only where the physics demand it - a larger roast takes longer, a pan of boiling pasta does not. Keep the title, description and tags unchanged.

${HOUSE_STYLE}

${tagGuidance(existingTags)}`;
}

export const IMAGE_EXTRACT_PROMPT = `Transcribe the recipe shown in these images. They may be different pages or sections of one recipe, so combine them into a single coherent transcription.

Include the title, any introduction, all ingredients with their quantities, every step of the method, and any times, temperatures or serving information. Reproduce what the images say rather than converting or improving it.`;

/** Serialise just the fields the assistant needs to reason about a recipe. */
function recipeContext(recipe: RecipeWithDetails): string {
  return JSON.stringify(
    {
      title: recipe.title,
      description: recipe.description,
      servings: recipe.servings,
      prepTimeMinutes: recipe.prepTimeMinutes,
      cookTimeMinutes: recipe.cookTimeMinutes,
      ingredients: recipe.ingredients.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        notes: i.notes,
      })),
      steps: recipe.steps.map((s) => s.instruction),
      tags: recipe.tags.map((t) => t.tag),
      servingSizesAvailable: recipe.portionVariants?.map((v) => v.servings),
    },
    null,
    2
  );
}

export function chatSystemPrompt(
  recipe: RecipeWithDetails,
  existingTags: string[]
): string {
  return `You are a helpful cooking assistant, talking to the person who is about to cook this recipe:

${recipeContext(recipe)}

Answer their questions conversationally and keep it brief.

When they ask for a change to the recipe - a substitution, a dietary variation, a different number of servings - reply with a short message saying what you have done and call the propose_recipe tool with the complete modified recipe. Describing a change in prose alone is not enough: the user can only save a recipe that arrives through the tool. Conversely, when they are only asking a question, just answer it and leave the tool alone.

Set variantType to "portion" when the number of servings is the only thing that changed, and "content" when the ingredients or method differ. When changing servings, interpolate from the serving sizes already recorded above rather than scaling blindly.

${HOUSE_STYLE}

${tagGuidance(existingTags)}`;
}
