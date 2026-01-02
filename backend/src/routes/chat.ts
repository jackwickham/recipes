import { Router } from "express";

export const chatRouter = Router();

// GET /api/recipes/:id/chat - Get chat history
chatRouter.get("/:id/chat", (req, res) => {
  const { id } = req.params;
  // TODO: Implement once database is set up
  res.json([]);
});

// POST /api/recipes/:id/chat - Send message, get response
chatRouter.post("/:id/chat", async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;
  // TODO: Implement LLM chat with recipe context
  res.json({
    message: `I received your message about recipe ${id}: "${message}"`,
    updatedRecipe: null,
  });
});
