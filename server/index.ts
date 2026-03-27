import express, { type Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { wsClients } from "./realtime";

const app = express();
const httpServer = createServer(app);

// ── WebRTC Signaling + Real-time Events via WebSocket ─────────────────────
const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
const randomCallQueue: string[] = []; // userIds waiting for a random match

wss.on("connection", (ws) => {
  let userId: string | null = null;

  const removeFromQueue = (uid: string) => {
    const idx = randomCallQueue.indexOf(uid);
    if (idx !== -1) randomCallQueue.splice(idx, 1);
  };

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      // ── Register user ──
      if (msg.type === "register") {
        userId = String(msg.userId);
        wsClients.set(userId, ws);
        ws.send(JSON.stringify({ type: "registered" }));
        return;
      }

      // ── Random call matchmaking ──
      if (msg.type === "random-call-join") {
        if (!userId) return;
        // Try to find a waiting partner
        let matched = false;
        while (randomCallQueue.length > 0) {
          const partnerId = randomCallQueue.shift()!;
          if (partnerId === userId) continue; // skip self
          const partnerWs = wsClients.get(partnerId);
          if (partnerWs && partnerWs.readyState === WebSocket.OPEN) {
            // Shared Agora channel for this pair (deterministic, order-independent)
            const agoraChannel = `random_${[userId, partnerId].sort().join("_")}`;
            // Pair them — both get the shared channel name so they join the same Agora room
            partnerWs.send(JSON.stringify({ type: "random-call-matched", role: "callee", partnerId: userId, agoraChannel }));
            ws.send(JSON.stringify({ type: "random-call-matched", role: "caller", partnerId, agoraChannel }));
            matched = true;
            break;
          }
        }
        if (!matched) {
          // No one waiting — add to queue
          if (!randomCallQueue.includes(userId)) randomCallQueue.push(userId);
          ws.send(JSON.stringify({ type: "random-call-waiting", queueSize: randomCallQueue.length }));
        }
        return;
      }

      // ── Leave random call queue ──
      if (msg.type === "random-call-leave") {
        if (userId) removeFromQueue(userId);
        return;
      }

      // ── Forward signaling messages to target user ──
      if (msg.to) {
        const target = wsClients.get(String(msg.to));
        if (target && target.readyState === WebSocket.OPEN) {
          target.send(JSON.stringify({ ...msg, from: userId }));
        }
      }
    } catch { /* ignore malformed messages */ }
  });

  ws.on("close", () => {
    if (userId) {
      wsClients.delete(userId);
      removeFromQueue(userId);
    }
  });
  ws.on("error", () => {
    if (userId) {
      wsClients.delete(userId);
      removeFromQueue(userId);
    }
  });
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "50mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// ── Rate Limiting ────────────────────────────────────────────────────────────
// Strict limit on auth routes (prevent brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again in 15 minutes." },
  skip: () => process.env.NODE_ENV === "development",
});

// General API rate limit (prevent bot scraping)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, // 200 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down." },
  // Skip rate limiting in dev AND for chunk/finalize upload endpoints (they're already auth-gated)
  skip: (req) => process.env.NODE_ENV === "development" || req.path.startsWith("/upload/"),
});

app.use("/api/auth", authLimiter);
app.use("/api", apiLimiter);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM - process is being terminated");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Received SIGINT - process is being interrupted");
  process.exit(0);
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
