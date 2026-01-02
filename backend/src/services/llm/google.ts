import { GoogleGenAI } from "@google/genai";
import type { LLM } from "./interface.js";

export class GoogleLLM implements LLM {
  private client: GoogleGenAI;
  private textModel: string;
  private imageModel: string;

  constructor(apiKey: string, textModel: string, imageModel: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.textModel = textModel;
    this.imageModel = imageModel;
  }

  async complete(prompt: string): Promise<string> {
    const response = await this.client.models.generateContent({
      model: this.textModel,
      contents: prompt,
    });
    return response.text ?? "";
  }

  async completeWithImage(prompt: string, imageBase64: string): Promise<string> {
    // Detect mime type from base64 header or default to jpeg
    let mimeType = "image/jpeg";
    let data = imageBase64;

    if (imageBase64.startsWith("data:")) {
      const match = imageBase64.match(/^data:([^;]+);base64,/);
      if (match) {
        mimeType = match[1];
        data = imageBase64.replace(/^data:[^;]+;base64,/, "");
      }
    }

    const response = await this.client.models.generateContent({
      model: this.imageModel,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data,
              },
            },
          ],
        },
      ],
    });

    return response.text ?? "";
  }
}
