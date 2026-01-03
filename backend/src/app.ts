import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { recipesRouter } from "./routes/recipes.js";
import { importRouter } from "./routes/import.js";
import { chatRouter } from "./routes/chat.js";
import { errorHandler } from "./middleware/error-handler.js";
import { getDb } from "./db/index.js";
import { getAllTags } from "./db/queries.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

// Initialize database
getDb();

app.use(express.json({ limit: "10mb" }));

// API routes
app.use("/api/recipes", recipesRouter);
app.use("/api/recipes", chatRouter); // Chat routes are /api/recipes/:id/chat
app.use("/api/import", importRouter);

// Tags endpoint
app.get("/api/tags", (_req, res) => {
  const tags = getAllTags();
  res.json(tags);
});

// Serve frontend in production
const frontendPath = path.join(__dirname, "../../frontend/dist");
app.use(express.static(frontendPath));
app.get("/*path", (_req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

// Error handling
app.use(errorHandler);
