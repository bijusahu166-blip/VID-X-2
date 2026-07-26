import type { Express, Request, Response } from "express";
import { chatStorage } from "./storage";

export function registerChatRoutes(app: Express) {

  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      const conversation = await chatStorage.getConversation(id);
      if (!conversation) return res.status(404).json({ error: "Not found" });
      const messages = await chatStorage.getMessagesByConversation(id);
      res.json({ ...conversation, messages });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      const { title } = req.body;
      const conversation = await chatStorage.createConversation(title || "New Chat");
      res.status(201).json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.delete("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(String(req.params.id), 10);
      await chatStorage.deleteConversation(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  app.post("/api/conversations/:id/messages", async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(String(req.params.id), 10);
      const { content } = req.body;

      const savedMessage = await chatStorage.createMessage(conversationId, "user", content);

      res.status(201).json(savedMessage);
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });
}