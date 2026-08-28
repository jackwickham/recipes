import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";

describe("Backend Integration Smoke Tests", () => {
  it("should serve the frontend on wildcard routes (fix for Express 5 PathError)", async () => {
    // This specifically tests the "/*path" route which caused the crash
    const response = await request(app).get("/some/random/path/to/frontend");
    
    // Should return 200 and HTML content (index.html)
    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/text\/html/);
  });

  it("should return recipes API response", async () => {
    const response = await request(app).get("/api/recipes");
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it("should return tags API response", async () => {
    const response = await request(app).get("/api/tags");
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  // Chat behaviour itself is covered in llm.test.ts, against an injected LLM.
  it("should 404 chat for a recipe that does not exist", async () => {
    const response = await request(app)
      .post("/api/recipes/999999/chat")
      .send({ message: "Hello", history: [] });

    expect(response.status).toBe(404);
  });
});
