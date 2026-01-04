import { Router } from "express";
import {
  getRecipeById,
  getChatHistory,
  addChatMessage,
  deleteChatHistory,
} from "../db/queries.js";
import { getLLM } from "../services/llm/index.js";
import type { ParsedRecipe } from "@recipes/shared";

export const chatRouter = Router();

// GET /api/recipes/:id/chat - Get chat history
chatRouter.get("/:id/chat", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid recipe ID" });
    return;
  }

  const history = getChatHistory(id);
  res.json(history);
});

// DELETE /api/recipes/:id/chat - Clear chat history
chatRouter.delete("/:id/chat", (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid recipe ID" });
    return;
  }

  deleteChatHistory(id);
  res.json({ success: true });
});

// POST /api/recipes/:id/chat - Send message, get response
chatRouter.post("/:id/chat", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid recipe ID" });
      return;
    }

    const { message } = req.body;
    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const recipe = getRecipeById(id);
    if (!recipe) {
      res.status(404).json({ error: "Recipe not found" });
      return;
    }

    // Save user message
    addChatMessage(id, "user", message);

    // Get chat history for context
    const history = getChatHistory(id);

    // Build prompt with recipe context
    const prompt = buildChatPrompt(recipe, history);

    // Get LLM response
    const llm = getLLM();
    const response = await llm.complete(prompt);

    // Parse response
    const { text, updatedRecipes } = parseChatResponse(response);

    // Save assistant message
    addChatMessage(
      id,
      "assistant",
      text,
      updatedRecipes.length > 0 ? JSON.stringify(updatedRecipes) : null
    );

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

function buildChatPrompt(
  recipe: ReturnType<typeof getRecipeById>,
  history: ReturnType<typeof getChatHistory>
): string {
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
      tags: recipe!.tags.map((t) => t.tag),
      portionVariants: recipe!.portionVariants?.map((v) => ({
        id: v.id,
        servings: v.servings,
      })),
    },
    null,
    2
  );

  let prompt = `You are a helpful cooking assistant. You have access to the following recipe:

${recipeJson}

When answering questions:
1. Be helpful and conversational
2. If the user asks for modifications (substitutions, dietary changes, content changes), provide the updated recipe
3. Use British English and metric units

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
        {"instruction": "Step with {{qty:500:g}} markers and {{timer:15}} if needed"}
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
        {"instruction": "Step with {{qty:400:g}} markers"}
      ],
      "suggestedTags": ["vegetarian"]
    }
  ]
}

`;

  // Add conversation history
  if (history.length > 1) {
    prompt += "\nConversation history:\n";
    // Skip the last message (it's the current one)
    for (const msg of history.slice(0, -1)) {
      prompt += `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}\n`;
    }
    prompt += "\n";
  }

  // Add current message
  const lastMessage = history[history.length - 1];
  if (lastMessage) {
    prompt += `User: ${lastMessage.content}\n\nRespond with valid JSON:`;
  }

  return prompt;
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

    // Normalize steps to ensure they're objects with instruction fields
    recipes = recipes.map(recipe => ({
      ...recipe,
      steps: recipe.steps.map(step =>
        typeof step === 'string' ? { instruction: step } : step
      )
    }));

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
