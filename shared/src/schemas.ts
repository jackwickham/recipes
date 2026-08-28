import { z } from "zod";

/**
 * Single source of truth for every recipe payload the LLM produces.
 *
 * These schemas drive three things at once: the TypeScript types exported from
 * this package, the JSON Schema sent to the provider to constrain generation,
 * and runtime validation of what comes back. Field-level `.describe()` calls
 * replace the hand-written JSON examples that used to live in each prompt.
 */

export const ingredientSchema = z.object({
  name: z
    .string()
    .describe("Ingredient name, in British English (aubergine, not eggplant)"),
  quantity: z
    .number()
    .nullable()
    .describe("Numeric amount, or null for vague amounts like 'to taste'"),
  unit: z
    .string()
    .nullable()
    .describe(
      "Metric unit such as g, ml, tsp or tbsp. Null for countable items like eggs"
    ),
  notes: z
    .string()
    .nullable()
    .describe("Optional prep note such as 'diced' or 'room temperature'"),
});

export const stepSchema = z.object({
  instruction: z
    .string()
    .describe(
      "A single main action. Mark durations with {{timer:M}}, where M is minutes " +
        "(for example {{timer:15}} for 15 minutes, {{timer:0.5}} for 30 seconds)"
    ),
});

/** Fields that describe one cookable version of a dish at a given serving size. */
const recipeBody = {
  servings: z.number().nullable().describe("Number of servings this yields"),
  prepTimeMinutes: z.number().nullable().describe("Preparation time in minutes"),
  cookTimeMinutes: z.number().nullable().describe("Cooking time in minutes"),
  ingredients: z.array(ingredientSchema),
  steps: z
    .array(stepSchema)
    .describe(
      "Method steps. Keep one main action per step: 'add the flour, then beat in " +
        "the eggs' is one step, but 'add the flour and grease the tin' is two"
    ),
};

const recipeHeader = {
  title: z.string(),
  description: z.string().nullable().describe("Brief description of the dish"),
  suggestedTags: z
    .array(z.string())
    .describe("Lowercase tags for filtering, reusing existing tags where they fit"),
};

/** A complete standalone recipe. Used for generation, scaling and chat proposals. */
export const parsedRecipeSchema = z.object({
  ...recipeHeader,
  ...recipeBody,
});

/** One serving size within a multi-portion recipe. Title and tags live on the parent. */
export const parsedPortionVariantSchema = z.object({
  ...recipeBody,
  servings: z.number().describe("Number of servings this variant yields"),
});

/**
 * What the parser extracts from a source. Always variant-shaped: a recipe with a
 * single serving size is just one variant, which avoids asking the model to pick
 * between two output formats.
 */
export const recipeExtractionSchema = z.object({
  ...recipeHeader,
  variants: z
    .array(parsedPortionVariantSchema)
    .min(1)
    .describe(
      "One entry per serving size. Use a single entry unless the source explicitly " +
        "lists different quantities for different serving sizes, in which case " +
        "include every one of them with its exact quantities"
    ),
});

/**
 * Photo import, done as one call. `transcription` comes first deliberately: the
 * model fills the fields in schema order, so it reads the images out in full
 * before extracting structure from what it read.
 */
export const recipeFromImagesSchema = z
  .object({
    transcription: z
      .string()
      .describe(
        "Everything the images say about this recipe, transcribed verbatim and " +
          "combined across all of them in reading order. Reproduce the source " +
          "rather than converting or improving it"
      ),
  })
  .extend(recipeExtractionSchema.shape);

/** A recipe the assistant proposes during chat, tagged with how it relates to the original. */
export const proposedRecipeSchema = parsedRecipeSchema.extend({
  variantType: z
    .enum(["portion", "content"])
    .describe(
      "'portion' when this is the same dish at a different serving size, " +
        "'content' when the ingredients or method have changed"
    ),
});

export type ParsedRecipePayload = z.infer<typeof parsedRecipeSchema>;
export type ParsedIngredient = z.infer<typeof ingredientSchema>;
export type ParsedStep = z.infer<typeof stepSchema>;
export type ParsedPortionVariant = z.infer<typeof parsedPortionVariantSchema>;
export type RecipeExtraction = z.infer<typeof recipeExtractionSchema>;
export type RecipeFromImages = z.infer<typeof recipeFromImagesSchema>;
export type ProposedRecipe = z.infer<typeof proposedRecipeSchema>;

/**
 * Convert a zod schema to the JSON Schema dialect both providers accept.
 *
 * zod emits `additionalProperties: false` with every key required, which is what
 * OpenAI strict mode demands. `$schema` is dropped because neither provider lists
 * it among the supported keywords.
 */
export function toProviderJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}
