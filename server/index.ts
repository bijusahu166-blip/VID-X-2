import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { apiLimiter, authLimiter, uploadLimiter } from "./middleware/rateLimiter";
import compression from "compression";
import helmet from "helmet";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { wsClients } from "./realtime";
import { errorHandler, asyncHandler } from "./middleware/errorHandler";
import { paginationMiddleware } from "./utils/pagination";
import { db } from "./db";
import { sql } from "drizzle-orm";

const app = express();
const httpServer = createServer(app);

// ── WebRTC Signaling + Real-time Events via WebSocket ─────────────────────
// Use noServer:true so that upgrade requests for OTHER paths (e.g. Vite's
// /vite-hmr) are not aborted with 400 by the ws library.  We install our own
// 'upgrade' listener that only handles the /ws path; everything else is left
// for subsequent listeners (Vite HMR) to process.
const wss = new WebSocketServer({ noServer: true });
const randomCallQueue: string[] = []; // userIds waiting for a random match

httpServer.on("upgrade", (req, socket, head) => {
  const pathname = (req.url || "").split("?")[0];
  if (pathname === "/ws") {
    wss.handleUpgrade(req, socket as any, head, (ws) => {
      wss.emit("connection", ws, req);
    });
    // All other paths (e.g. /vite-hmr for Vite HMR) are intentionally left
    // unhandled here so subsequent 'upgrade' listeners can process them.
  }
});

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
            partnerWs.send(
              JSON.stringify({
                type: "random-call-matched",
                role: "callee",
                partnerId: userId,
                agoraChannel,
              }),
            );
            ws.send(
              JSON.stringify({
                type: "random-call-matched",
                role: "caller",
                partnerId,
                agoraChannel,
              }),
            );
            matched = true;
            break;
          }
        }
        if (!matched) {
          // No one waiting — add to queue
          if (!randomCallQueue.includes(userId)) randomCallQueue.push(userId);
          ws.send(
            JSON.stringify({
              type: "random-call-waiting",
              queueSize: randomCallQueue.length,
            }),
          );
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
    } catch {
      /* ignore malformed messages */
    }
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

// ── Security & Performance Headers ──────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));

// ── Compression ─────────────────────────────────────────────────────────────
app.use(compression());

import session from 'express-session';

app.use(session({
secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 din
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  }
}));
// ── CORS ────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || process.env.NODE_ENV === "production" ? "*" : "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ── Pagination Middleware ──────────────────────────────────────────────────
app.use(paginationMiddleware);

app.use(
  express.json({
    limit: "300mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: "300mb" }));

// ── Rate Limiting ────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter);
app.use("/api/upload", uploadLimiter);
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
  // ── Health Check Endpoint ───────────────────────────────────────────────────
  app.get("/health", asyncHandler(async (req: Request, res: Response) => {
    try {
      // Test database connection
      await db.execute(sql`SELECT NOW()`);
      res.json({
        status: "healthy",
        database: "connected",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
      });
    } catch (err: any) {
      res.status(503).json({
        status: "unhealthy",
        database: "disconnected",
        error: process.env.NODE_ENV === "development" ? err.message : "Database unavailable",
      });
    }
  }));

  // ── Readiness Check (for container orchestration) ──────────────────────────
  app.get("/ready", (req: Request, res: Response) => {
    res.json({ ready: true });
  });

  await registerRoutes(httpServer, app);

  // ── Error Handling Middleware (must be last) ────────────────────────────────
  app.use(errorHandler);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Unhandled Error:", err);
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
  // Other ports are firewalled. Default to 10000 if not specified.
  const port = Number(process.env.PORT ? Number(process.env.PORT) : 10000);
  console.log(`Starting server with PORT=${process.env.PORT} resolved port=${port}`);
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server started on port ${port}`);
    log(`serving on port ${port}`);
  });
})();
