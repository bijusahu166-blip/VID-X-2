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
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { setupAuth } from "./replit_integrations/auth";

const app = express();
const httpServer = createServer(app);

const wss = new WebSocketServer({ noServer: true });

const randomCallQueue: string[] = [];

httpServer.on("upgrade", (req, socket, head) => {
  const pathname = (req.url || "").split("?")[0];
  if (pathname === "/ws") {
    wss.handleUpgrade(req, socket as any, head, (ws) => {
      wss.emit("connection", ws, req);
    });
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

      if (msg.type === "register") {
        userId = String(msg.userId);
        wsClients.set(userId, ws);
        ws.send(JSON.stringify({ type: "registered" }));
        return;
      }

      if (msg.type === "random-call-join") {
        if (!userId) return;
        let matched = false;
        while (randomCallQueue.length > 0) {
          const partnerId = randomCallQueue.shift()!;
          if (partnerId === userId) continue;
          const partnerWs = wsClients.get(partnerId);
          if (partnerWs && partnerWs.readyState === WebSocket.OPEN) {
            const agoraChannel = `random_${[userId, partnerId].sort().join("_")}`;
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

      if (msg.type === "random-call-leave") {
        if (userId) removeFromQueue(userId);
        return;
      }

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

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));

app.use(compression());

app.use(cors({
  origin: [
    "https://iqpartner.xyz",
    "https://www.iqpartner.xyz",
    "capacitor://localhost",
    "https://localhost",
    "http://localhost",
    process.env.FRONTEND_URL,
  ].filter((origin): origin is string => Boolean(origin)),
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

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
  // ── Session (single source of truth — PostgreSQL-backed) ──────────────────
  await setupAuth(app);

  // ── Google OAuth (uses the session set up above) ───────────────────────────
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: "/api/auth/google/callback",
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(new Error("No email from Google"));
      let user = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (user.length === 0) {
        const inserted = await db.insert(users).values({
          email,
          firstName: profile.name?.givenName || "User",
          lastName: profile.name?.familyName || "",
          username: email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, ""),
          profileImageUrl: profile.photos?.[0]?.value || "",
          password: "",
        }).returning();
        return done(null, inserted[0]);
      }
      return done(null, user[0]);
    } catch (err) {
      return done(err as any);
    }
  }));

  passport.serializeUser((user: any, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await db.select().from(users).where(eq(users.id, id)).limit(1);
      done(null, user[0] || null);
    } catch (err) { done(err as any); }
  });

  app.use(passport.initialize());
  app.use(passport.session());

  app.get("/api/auth/google",
    (req, res, next) => {
      passport.authenticate("google", {
        scope: ["profile", "email"],
        state: req.query.platform === "app" ? "app" : "web",
      })(req, res, next);
    }
  );

  app.get("/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/" }),
    (req: any, res) => {
      req.session.userId = req.user.id;
      req.session.save(() => {
        if (req.query.state === "app") {
          res.redirect("iqpartner://auth-callback");
        } else {
          res.redirect("/");
        }
      });
    }
  );

  // ── Health Check Endpoint ───────────────────────────────────────────────────
  app.get("/health", asyncHandler(async (req: Request, res: Response) => {
    try {
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

  app.get("/ready", (req: Request, res: Response) => {
    res.json({ ready: true });
  });

  await registerRoutes(httpServer, app);

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

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = Number(process.env.PORT ? Number(process.env.PORT) : 10000);
  console.log(`Starting server with PORT=${process.env.PORT} resolved port=${port}`);
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(`Server started on port ${port}`);
    log(`serving on port ${port}`);
  });
})();