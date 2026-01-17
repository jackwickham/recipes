import { Router } from "express";
import { getRecipeById, getTagsForPrompt } from "../db/queries.js";
import { getLLM } from "../services/llm/index.js";
import type { Message } from "../services/llm/interface.js";
import type { ParsedRecipe } from "@recipes/shared";

export const chatRouter = Router();

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  metadata?: string | null;
  createdAt: string;
}

// POST /api/recipes/:id/chat - Send message, get response
chatRouter.post("/:id/chat", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid recipe ID" });
      return;
    }

    const { message, history } = req.body;
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    // Validate history if present
    const chatHistory: ChatMessage[] = Array.isArray(history) ? history : [];

    const recipe = getRecipeById(id);
    if (!recipe) {
      res.status(404).json({ error: "Recipe not found" });
      return;
    }

    // Build system prompt and messages
    const existingTags = getTagsForPrompt();
    const systemPrompt = buildChatSystemPrompt(recipe, existingTags);

    // Convert chat history to LLM messages and add current message
    const messages: Message[] = chatHistory.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
    messages.push({ role: "user", content: message });

    // Get LLM response
    const llm = getLLM();
    const response = await llm.completeChat(systemPrompt, messages);

    // Parse response
    const { text, updatedRecipes } = parseChatResponse(response);

    res.json({
      message: text,
      updatedRecipes,
    });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Chat failed",
    });
  }
});

function buildChatSystemPrompt(
  recipe: ReturnType<typeof getRecipeById>,
  existingTags: string[]
): string {
  const tagList = existingTags.join(", ");
  const recipeJson = JSON.stringify(
    {
      id: recipe!.id,
      title: recipe!.title,
      description: recipe!.description,
      servings: recipe!.servings,
      prepTimeMinutes: recipe!.prepTimeMinutes,
      cookTimeMinutes: recipe!.cookTimeMinutes,
      ingredients: recipe!.ingredients.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit: i.unit,
        notes: i.notes,
      })),
      steps: recipe!.steps.map((s) => s.instruction),
      suggestedTags: recipe!.tags.map((t) => t.tag),
      portionVariants: recipe!.portionVariants?.map((v) => ({
        id: v.id,
        servings: v.servings,
      })),
    },
    null,
    2
  );

  return `You are a helpful cooking assistant. You have access to the following recipe:

${recipeJson}

When answering questions:
1. Be helpful and conversational
2. If the user asks for modifications (substitutions, dietary changes, content changes), provide the updated recipe
3. Use British English and metric units
4. When suggesting tags, prefer using existing tags: ${tagList}
   You may create new tags if existing tags aren't a good fit, but prefer existing tags for consistency.

PORTION VARIANTS:
- If the user requests a different portion size (e.g., "make this for 6 people"), create a PORTION VARIANT
- Portion variants should have the SAME title and description as the parent recipe
- Use existing portionVariants as reference for accurate quantity interpolation
- Include "parentRecipeId" and "variantType": "portion" in the response
- ONLY create portion variants when the user explicitly requests a different portion size
- For content changes (e.g., "make it vegetarian"), create a regular recipe WITHOUT parentRecipeId

IMPORTANT: Your response must be valid JSON in this format:
{
  "message": "Your conversational response to the user",
  "updatedRecipes": []
}

If you're providing modified recipes, include them in updatedRecipes as an array of objects.

For PORTION VARIANTS (same recipe, different serving size):
{
  "message": "I've created a version for 6 servings",
  "updatedRecipes": [
    {
      "title": "Same Title as Parent",
      "description": "Same description",
      "servings": 6,
      "prepTimeMinutes": 15,
      "cookTimeMinutes": 30,
      "parentRecipeId": ${recipe!.parentRecipeId || recipe!.id},
      "variantType": "portion",
      "ingredients": [
        {"name": "flour", "quantity": 500, "unit": "g", "notes": null}
      ],
      "steps": [
        {"instruction": "Step with 500g flour and {{timer:15}} if needed"}
      ],
      "suggestedTags": ["vegetarian", "quick"]
    }
  ]
}

For CONTENT CHANGES (different ingredients/method):
{
  "message": "Here's a vegetarian version",
  "updatedRecipes": [
    {
      "title": "Modified Recipe Title",
      "description": "Updated description",
      "servings": 4,
      "prepTimeMinutes": 15,
      "cookTimeMinutes": 30,
      "ingredients": [
        {"name": "tofu", "quantity": 400, "unit": "g", "notes": null}
      ],
      "steps": [
        {"instruction": "Step with 400g tofu"}
      ],
      "suggestedTags": ["vegetarian"]
    }
  ]
}`;
}

function parseChatResponse(response: string): {
  text: string;
  updatedRecipes: ParsedRecipe[];
} {
  try {
    // Try to parse as JSON
    let jsonStr = response;

    // Handle markdown code blocks
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Try to find JSON object
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    let recipes: ParsedRecipe[] = [];
    if (Array.isArray(parsed.updatedRecipes)) {
      recipes = parsed.updatedRecipes;
    } else if (parsed.updatedRecipe) {
      recipes = [parsed.updatedRecipe];
    }

    // Normalize recipes to ensure they match ParsedRecipe structure
    recipes = recipes.map((recipe) => {
      // Handle missing or mismatched tags field
      // Some LLMs return "tags" instead of "suggestedTags"
      const tags = recipe.suggestedTags || (recipe as any).tags || [];

      return {
        ...recipe,
        steps: recipe.steps.map((step) =>
          typeof step === "string" ? { instruction: step } : step
        ),
        suggestedTags: Array.isArray(tags) ? tags : [],
      };
    });

    return {
      text: parsed.message || response,
      updatedRecipes: recipes,
    };
  } catch {
    // If parsing fails, return the raw response
    return {
      text: response,
      updatedRecipes: [],
    };
  }
}
