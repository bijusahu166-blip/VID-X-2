import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import pg from "pg";

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

let sessionStoreReady = false;

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  
  let sessionStore: any = new session.MemoryStore();
  
  const initializeSessionStore = async () => {
    try {
      const pgSession = new pgStore({
        pool,
        createTableIfMissing: true,
        ttl: sessionTtl,
        tableName: "sessions",
      });

      await pool.query("SELECT NOW()");
      console.log("[Session Store] PostgreSQL connected");
      sessionStore = pgSession;
      sessionStoreReady = true;
    } catch (err: any) {
      console.warn("[Session Store] PostgreSQL connection failed, using memory store:", err?.message || err);
      sessionStore = new session.MemoryStore();
    }
  };
  
  initializeSessionStore().catch((err) => {
    console.warn("[Session Store] Initialization failed, using memory store:", err?.message || err);
    sessionStore = new session.MemoryStore();
  });
  
  return session({
    secret: process.env.SESSION_SECRET || "default-session-secret",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
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
