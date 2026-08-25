import express, { type Express, type Request, type Response } from "express";
import { chatStorage } from "../chat/storage";
import { openai, speechToText, ensureCompatibleFormat } from "./client";

const audioBodyParser = express.json({ limit: "50mb" });

function getParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function getPositiveIntParam(value: string | string[] | undefined): number | null {
  const raw = getParam(value);
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function registerAudioRoutes(app: Express): void {
  app.get("/api/conversations", async (_req: Request, res: Response) => {
    try {
      const conversations = await chatStorage.getAllConversations();
      return res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      return res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = getPositiveIntParam(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid conversation ID" });

      const conversation = await chatStorage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const messages = await chatStorage.getMessagesByConversation(id);
      return res.json({ ...conversation, messages });
    } catch (error) {
      console.error("Error fetching conversation:", error);
      return res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/conversations", async (req: Request, res: Response) => {
    try {
      const title =
        typeof req.body?.title === "string" && req.body.title.trim()
          ? req.body.title.trim()
          : "New Chat";

      const conversation = await chatStorage.createConversation(title);
      return res.status(201).json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      return res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.delete("/api/conversations/:id", async (req: Request, res: Response) => {
    try {
      const id = getPositiveIntParam(req.params.id);
      if (!id) return res.status(400).json({ error: "Invalid conversation ID" });

      const conversation = await chatStorage.getConversation(id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      await chatStorage.deleteConversation(id);
      return res.status(204).send();
    } catch (error) {
      console.error("Error deleting conversation:", error);
      return res.status(500).json({ error: "Failed to delete conversation" });
    }
  });

  app.post(
    "/api/conversations/:id/messages",
    audioBodyParser,
    async (req: Request, res: Response) => {
      try {
        const conversationId = getPositiveIntParam(req.params.id);
        if (!conversationId) {
          return res.status(400).json({ error: "Invalid conversation ID" });
        }

        const conversation = await chatStorage.getConversation(conversationId);
        if (!conversation) {
          return res.status(404).json({ error: "Conversation not found" });
        }

        const { audio, voice = "alloy" } = req.body ?? {};
        if (typeof audio !== "string" || !audio.trim()) {
          return res.status(400).json({ error: "Audio data (base64) is required" });
        }

        const rawBuffer = Buffer.from(audio, "base64");
        const { buffer: audioBuffer, format: inputFormat } =
          await ensureCompatibleFormat(rawBuffer);

        const userTranscript = await speechToText(audioBuffer, inputFormat);
        await chatStorage.createMessage(conversationId, "user", userTranscript);

        const existingMessages =
          await chatStorage.getMessagesByConversation(conversationId);

        const chatHistory = existingMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        res.write(
          `data: ${JSON.stringify({
            type: "user_transcript",
            data: userTranscript,
          })}\n\n`
        );

        const stream = await openai.chat.completions.create({
          model: "gpt-audio",
          modalities: ["text", "audio"],
          audio: { voice, format: "pcm16" },
          messages: chatHistory,
          stream: true,
        });

        let assistantTranscript = "";

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta as any;
          if (!delta) continue;

          if (delta.audio?.transcript) {
            assistantTranscript += delta.audio.transcript;
            res.write(
              `data: ${JSON.stringify({
                type: "transcript",
                data: delta.audio.transcript,
              })}\n\n`
            );
          }

          if (delta.audio?.data) {
            res.write(
              `data: ${JSON.stringify({
                type: "audio",
                data: delta.audio.data,
              })}\n\n`
            );
          }
        }

        if (assistantTranscript.trim()) {
          await chatStorage.createMessage(
            conversationId,
            "assistant",
            assistantTranscript
          );
        }

        res.write(
          `data: ${JSON.stringify({
            type: "done",
            transcript: assistantTranscript,
          })}\n\n`
        );
        return res.end();
      } catch (error) {
        console.error("Error processing voice message:", error);

        if (res.headersSent) {
          res.write(
            `data: ${JSON.stringify({
              type: "error",
              error: "Failed to process voice message",
            })}\n\n`
          );
          return res.end();
        }

        return res
          .status(500)
          .json({ error: "Failed to process voice message" });
      }
    }
  );
}