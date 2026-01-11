import { Router } from "express";
import {
  parseRecipeFromText,
  parseRecipeFromImages,
  parseRecipeFromUrl,
  generateRecipeFromPrompt,
} from "../services/recipe-parser.js";

export const importRouter = Router();

// POST /api/import/url - Import from URL
importRouter.post("/url", async (req, res, next) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    // Fetch the HTML content
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; RecipeBot/1.0; +http://localhost)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      return res
        .status(400)
        .json({ error: `Failed to fetch URL: ${response.statusText}` });
    }

    const html = await response.text();
    const { extractedText, recipe } = await parseRecipeFromUrl(html);

    res.json({
      sourceType: "url",
      sourceText: extractedText,
      sourceContext: url,
      recipe,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/import/url/stream - Import from URL with SSE progress
importRouter.post("/url/stream", async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "URL is required" });
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent({ stage: "fetching", message: "Fetching recipe page..." });

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; RecipeBot/1.0; +http://localhost)",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }

    const html = await response.text();
    const { extractedText, recipe } = await parseRecipeFromUrl(
      html,
      (stage, message) => {
        sendEvent({ stage, message });
      }
    );

    sendEvent({
      stage: "complete",
      message: "Recipe imported successfully",
      data: {
        sourceType: "url",
        sourceText: extractedText,
        sourceContext: url,
        recipe,
      },
    });
  } catch (err) {
    sendEvent({
      stage: "error",
      message: err instanceof Error ? err.message : "Import failed",
    });
  }

  res.end();
});

// POST /api/import/photos - Import from photos
importRouter.post("/photos", async (req, res, next) => {
  try {
    const { images } = req.body;

    if (!Array.isArray(images) || images.length === 0) {
      return res
        .status(400)
        .json({ error: "At least one image is required" });
    }

    const { extractedText, recipe } = await parseRecipeFromImages(images);

    res.json({
      sourceType: "photo",
      sourceText: extractedText,
      sourceContext: null,
      recipe,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/import/photos/stream - Import from photos with SSE progress
importRouter.post("/photos/stream", async (req, res) => {
  const { images } = req.body;

  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: "At least one image is required" });
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { extractedText, recipe } = await parseRecipeFromImages(
      images,
      (stage, message) => {
        sendEvent({ stage, message });
      }
    );

    sendEvent({
      stage: "complete",
      message: "Recipe imported successfully",
      data: {
        sourceType: "photo",
        sourceText: extractedText,
        sourceContext: null,
        recipe,
      },
    });
  } catch (err) {
    sendEvent({
      stage: "error",
      message: err instanceof Error ? err.message : "Import failed",
    });
  }

  res.end();
});

// POST /api/import/text - Import from pasted text
importRouter.post("/text", async (req, res, next) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required" });
    }

    const recipe = await parseRecipeFromText(text);

    res.json({
      sourceType: "text",
      sourceText: text,
      sourceContext: null,
      recipe,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/import/text/stream - Import from pasted text with SSE progress
importRouter.post("/text/stream", async (req, res) => {
  const { text } = req.body;

  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "Text is required" });
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const sendEvent = (data: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const recipe = await parseRecipeFromText(text, (stage, message) => {
      sendEvent({ stage, message });
    });

    sendEvent({
      stage: "complete",
      message: "Recipe processed successfully",
      data: {
        sourceType: "text",
        sourceText: text,
        sourceContext: null,
        recipe,
      },
    });
  } catch (err) {
    sendEvent({
      stage: "error",
      message: err instanceof Error ? err.message : "Processing failed",
    });
  }

  res.end();
});

// POST /api/import/parse - Re-parse raw source text
importRouter.post("/parse", async (req, res, next) => {
  try {
    const { sourceText } = req.body;

    if (!sourceText || typeof sourceText !== "string") {
      return res.status(400).json({ error: "Source text is required" });
    }

    const recipe = await parseRecipeFromText(sourceText);

    res.json({ recipe });
  } catch (err) {
    next(err);
  }
});

// POST /api/import/generate - Generate a new recipe from a prompt
importRouter.post("/generate", async (req, res, next) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const recipe = await generateRecipeFromPrompt(prompt);

    res.json({
      sourceType: "text",
      sourceText: null,
      sourceContext: `Generated from prompt: ${prompt}`,
      recipe,
    });
  } catch (err) {
    next(err);
  }
});
