import { GoogleGenerativeAI } from "@google/generative-ai";
import { Buffer } from "node:buffer";
import fs from "node:fs";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "512x512" | "256x256" = "1024x1024"
): Promise<Buffer> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    const result = await model.generateContent(
      `Generate a detailed image description for: ${prompt}. 
       Return a placeholder response.`
    );
    // Gemini free tier does not support image generation
    // Return a placeholder image buffer
    const placeholderUrl = `https://picsum.photos/1024/1024?random=${Date.now()}`;
    const response = await fetch(placeholderUrl);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err: any) {
    console.error("[image] Error:", err.message);
    return Buffer.alloc(0);
  }
}

export async function editImages(
  imageFiles: string[],
  prompt: string,
  outputPath?: string
): Promise<Buffer> {
  try {
    const buffer = await generateImageBuffer(prompt);
    if (outputPath) fs.writeFileSync(outputPath, buffer);
    return buffer;
  } catch (err: any) {
    console.error("[editImages] Error:", err.message);
    return Buffer.alloc(0);
  }
}