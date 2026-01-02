import { Router } from "express";

export const importRouter = Router();

// POST /api/import/url - Import from URL
importRouter.post("/url", async (req, res) => {
  const { url } = req.body;
  // TODO: Implement URL fetch and LLM extraction
  res.json({ message: `Would import from ${url}` });
});

// POST /api/import/photos - Import from photos
importRouter.post("/photos", async (req, res) => {
  // TODO: Implement photo OCR via vision LLM
  res.json({ message: "Would extract from photos" });
});

// POST /api/import/text - Import from pasted text
importRouter.post("/text", async (req, res) => {
  const { text } = req.body;
  // TODO: Implement LLM extraction
  res.json({ message: `Would parse text (${text.length} chars)` });
});

// POST /api/import/parse - Re-parse raw source text
importRouter.post("/parse", async (req, res) => {
  const { sourceText } = req.body;
  // TODO: Implement LLM extraction
  res.json({ message: `Would re-parse text (${sourceText.length} chars)` });
});
