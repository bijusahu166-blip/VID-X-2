import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import pg from "pg";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const store = new pgStore({
    pool,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });

  return session({
    secret: process.env.SESSION_SECRET || "default-session-secret",
    store, // ✅ Direct PostgreSQL store — no async, no MemoryStore
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none" as const, // ✅ Cross-origin ke liye zaroori
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.session?.userId) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Guest-mode support: never blocks. Read-only routes (feed, stories) use
// this so logged-out visitors — including Play Store / Uptodown reviewers —
// can see content before signing in. Handlers get req.session.userId as
// undefined for guests and must treat that as "no personal data" (no
// hasLiked/hasSaved, no private posts), never as an error.
export const optionalAuth: RequestHandler = (_req, _res, next) => {
  next();
};