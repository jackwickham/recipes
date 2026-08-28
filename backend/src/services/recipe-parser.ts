import {
  recipeExtractionSchema,
  parsedRecipeSchema,
  type ParsedRecipe,
  type ParsedRecipeResult,
  type RecipeExtraction,
  type RecipeWithDetails,
} from "@recipes/shared";
import { getLLM } from "./llm/index.js";
import { ReasoningLevel } from "./llm/interface.js";
import { getTagsForPrompt } from "../db/queries.js";
import {
  IMAGE_EXTRACT_PROMPT,
  recipeGeneratePrompt,
  recipeParsePrompt,
  recipeScalePrompt,
} from "./prompts.js";

export type ProgressCallback = (stage: string, message: string) => void;

/**
 * The parser always asks for the variant-shaped schema so the model never has to
 * choose between two output formats. A source with one serving size comes back as
 * a single variant, which we flatten into a plain recipe for the rest of the app.
 */
function fromExtraction(extraction: RecipeExtraction): ParsedRecipeResult {
  if (extraction.variants.length > 1) {
    return extraction;
  }

  const [only] = extraction.variants;
  return {
    title: extraction.title,
    description: extraction.description,
    suggestedTags: extraction.suggestedTags,
    ...only,
  };
}

export async function parseRecipeFromText(
  text: string,
  onProgress?: ProgressCallback
): Promise<ParsedRecipeResult> {
  onProgress?.("parsing", "Parsing recipe details...");

  const extraction = await getLLM().completeStructured({
    systemPrompt: recipeParsePrompt(getTagsForPrompt()),
    messages: [{ role: "user", content: text }],
    schema: recipeExtractionSchema,
    schemaName: "recipe_extraction",
    options: { reasoning: ReasoningLevel.LOW },
  });

  return fromExtraction(extraction);
}

export async function parseRecipeFromImages(
  imagesBase64: string[],
  onProgress?: ProgressCallback
): Promise<{ extractedText: string; recipe: ParsedRecipeResult }> {
  onProgress?.(
    "extracting",
    `Extracting text from ${imagesBase64.length} image(s)...`
  );

  const extractedText = await getLLM().completeText({
    messages: [{ role: "user", content: IMAGE_EXTRACT_PROMPT }],
    images: imagesBase64,
    options: { reasoning: ReasoningLevel.LOW },
  });

  const recipe = await parseRecipeFromText(extractedText, onProgress);
  return { extractedText, recipe };
}

export async function parseRecipeFromUrl(
  html: string,
  onProgress?: ProgressCallback
): Promise<{ extractedText: string; recipe: ParsedRecipeResult }> {
  // The HTML itself becomes the source text
  const recipe = await parseRecipeFromText(html, onProgress);
  return { extractedText: html, recipe };
}

export async function generateRecipeFromPrompt(
  userPrompt: string
): Promise<ParsedRecipe> {
  return getLLM().completeStructured({
    systemPrompt: recipeGeneratePrompt(getTagsForPrompt()),
    messages: [{ role: "user", content: userPrompt }],
    schema: parsedRecipeSchema,
    schemaName: "generated_recipe",
    options: { reasoning: ReasoningLevel.MEDIUM },
  });
}

export async function generateScaledRecipe(
  recipe: RecipeWithDetails,
  targetServings: number
): Promise<ParsedRecipe> {
  const recipeJson = JSON.stringify(
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
      suggestedTags: recipe.tags.map((t) => t.tag),
    },
    null,
    2
  );

  return getLLM().completeStructured({
    systemPrompt: recipeScalePrompt(targetServings, getTagsForPrompt()),
    messages: [{ role: "user", content: recipeJson }],
    schema: parsedRecipeSchema,
    schemaName: "scaled_recipe",
    options: { reasoning: ReasoningLevel.LOW },
  });
}
