import { Inngest } from "inngest";
import { realtimeMiddleware } from "@inngest/realtime/middleware";

export const inngest = new Inngest(
  process.env.NODE_ENV === "production"
    ? {
        id: "replit-agent-workflow",
        name: "Replit Agent Workflow System",
      }
    : {
        id: "mastra",
        // ✅ Localhost ki jagah proper URL use karo
        baseUrl: process.env.INNGEST_BASE_URL || 
                 `http://127.0.0.1:${process.env.INNGEST_PORT ?? "3000"}`,
        isDev: true,
        middleware: [realtimeMiddleware()],
      }
);