import {
  recipeExtractionSchema,
  recipeFromImagesSchema,
  parsedRecipeSchema,
  type ParsedRecipe,
  type ParsedRecipeResult,
  type RecipeExtraction,
  type RecipeWithDetails,
} from "@recipes/shared";
import { getLLM } from "./llm/index.js";
import { ReasoningLevel } from "./llm/interface.js";
import { getTagsForPrompt } from "../db/queries.js";
import { extractRecipeSource } from "./source-extract.js";
import {
  JSON_LD_SOURCE_NOTE,
  PAGE_TEXT_SOURCE_NOTE,
  recipeFromImagesPrompt,
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

/**
 * Photos are transcribed and structured in one call: the schema asks for the
 * transcription first, so the model still reads the images out in full before
 * extracting from them, but we pay for one round trip instead of two.
 */
export async function parseRecipeFromImages(
  imagesBase64: string[],
  onProgress?: ProgressCallback
): Promise<{ extractedText: string; recipe: ParsedRecipeResult }> {
  onProgress?.("extracting", `Reading ${imagesBase64.length} image(s)...`);

  const { transcription, ...extraction } = await getLLM().completeStructured({
    systemPrompt: recipeFromImagesPrompt(getTagsForPrompt()),
    messages: [
      { role: "user", content: "Extract the recipe from these images." },
    ],
    images: imagesBase64,
    schema: recipeFromImagesSchema,
    schemaName: "recipe_from_images",
    options: { reasoning: ReasoningLevel.LOW },
  });

  return { extractedText: transcription, recipe: fromExtraction(extraction) };
}

/**
 * Pull the recipe out of the page before the model sees it. Sending raw HTML cost
 * hundreds of kilobytes per import and buried the recipe in markup; schema.org
 * JSON-LD, where a site publishes it, is both smaller and exact.
 */
export async function parseRecipeFromUrl(
  html: string,
  onProgress?: ProgressCallback
): Promise<{ extractedText: string; recipe: ParsedRecipeResult }> {
  const source = extractRecipeSource(html);

  onProgress?.(
    "extracting",
    source.kind === "json-ld"
      ? "Found structured recipe data..."
      : "Extracting recipe text from the page..."
  );

  const note =
    source.kind === "json-ld" ? JSON_LD_SOURCE_NOTE : PAGE_TEXT_SOURCE_NOTE;
  const recipe = await parseRecipeFromText(
    `${note}\n\n${source.text}`,
    onProgress
  );

  return { extractedText: source.text, recipe };
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
