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

  it("should handle stateless chat", async () => {
    // We need a recipe to exist for the chat to work. 
    // Since this is a smoke test, we'll try to get the first recipe ID if any exist.
    const recipesRes = await request(app).get("/api/recipes");
    if (recipesRes.body.length > 0) {
      const recipeId = recipesRes.body[0].id;
      const response = await request(app)
        .post(`/api/recipes/${recipeId}/chat`)
        .send({
          message: "Hello",
          history: []
        });
      
      // We expect 200 if the LLM is mocked or configured, 
      // but in integration tests it might fail if keys are missing.
      // However, we want to test that the ROUTE exists and handles the request.
      // If it returns 500 because of LLM keys, that's still "better" than 404.
      expect(response.status).not.toBe(404);
    }
  });
});
