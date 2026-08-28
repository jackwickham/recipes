import { Router } from "express";
import {
  proposedRecipeSchema,
  toProviderJsonSchema,
  type ParsedRecipe,
} from "@recipes/shared";
import { getRecipeById, getTagsForPrompt } from "../db/queries.js";
import { getLLM } from "../services/llm/index.js";
import {
  parseAgainstSchema,
  LLMResponseError,
  type Message,
  type ToolDefinition,
} from "../services/llm/interface.js";
import { chatSystemPrompt } from "../services/prompts.js";

export const chatRouter = Router();

/** Cap on turns of client-supplied history replayed to the model. */
const MAX_HISTORY_MESSAGES = 20;

const PROPOSE_RECIPE_TOOL: ToolDefinition = {
  name: "propose_recipe",
  description:
    "Offer the user a modified version of the recipe they are viewing. Call this " +
    "whenever you change ingredients, method or serving size, alongside a short " +
    "message explaining the change.",
  parameters: toProviderJsonSchema(proposedRecipeSchema),
};

/** Shown when the model proposes a recipe without any accompanying prose. */
const FALLBACK_MESSAGE = "Here's an updated version of the recipe.";

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

    const recipe = getRecipeById(id);
    if (!recipe) {
      res.status(404).json({ error: "Recipe not found" });
      return;
    }

    const messages: Message[] = [
      ...normaliseHistory(history),
      { role: "user", content: message },
    ];

    const response = await getLLM().completeWithTools({
      task: "chat",
      systemPrompt: chatSystemPrompt(recipe, getTagsForPrompt()),
      messages,
      tools: [PROPOSE_RECIPE_TOOL],
    });

    const updatedRecipes = collectProposedRecipes(response.toolCalls);
    const text =
      response.text.trim() || (updatedRecipes.length > 0 ? FALLBACK_MESSAGE : "");

    res.json({ message: text, updatedRecipes });
  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({
      error: err instanceof Error ? err.message : "Chat failed",
    });
  }
});

/**
 * History comes from the browser's localStorage, so it is untrusted and unbounded.
 * Keep only well-formed turns, and only the most recent ones.
 */
function normaliseHistory(history: unknown): Message[] {
  if (!Array.isArray(history)) return [];

  return history
    .filter(
      (msg): msg is Message =>
        !!msg &&
        typeof msg === "object" &&
        typeof (msg as Message).content === "string" &&
        ((msg as Message).role === "user" || (msg as Message).role === "assistant")
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((msg) => ({ role: msg.role, content: msg.content }));
}

/**
 * Validate each proposed recipe, dropping any the model malformed rather than
 * failing the whole reply - the conversational answer is still worth returning.
 */
function collectProposedRecipes(
  toolCalls: { name: string; arguments: unknown }[]
): ParsedRecipe[] {
  const recipes: ParsedRecipe[] = [];

  for (const call of toolCalls) {
    if (call.name !== PROPOSE_RECIPE_TOOL.name) continue;
    try {
      recipes.push(
        parseAgainstSchema(
          proposedRecipeSchema,
          JSON.stringify(call.arguments),
          PROPOSE_RECIPE_TOOL.name
        )
      );
    } catch (err) {
      if (!(err instanceof LLMResponseError)) throw err;
      console.warn("Discarding malformed recipe proposal:", err.message);
    }
  }

  return recipes;
}
