import type { Express, Request, Response } from "express";
import { generateImageBuffer } from "./client";

export function registerImageRoutes(app: Express): void {
  app.post("/api/generate-image", async (req: Request, res: Response) => {
    try {
      const { prompt, size = "1024x1024" } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      const buffer = await generateImageBuffer(prompt, size);
      const b64_json = buffer.toString("base64");

      res.json({
        url: `data:image/png;base64,${b64_json}`,
        b64_json,
      });
    } catch (error) {
      console.error("Error generating image:", error);
      res.status(500).json({ error: "Failed to generate image" });
    }
  });
}