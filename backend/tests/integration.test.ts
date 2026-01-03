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

  it("should handle chat history deletion", async () => {
    // Assuming recipe 1 exists from sample data or setup
    const response = await request(app).delete("/api/recipes/1/chat");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true });
  });
});
