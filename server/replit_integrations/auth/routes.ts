import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import bcrypt from "bcryptjs";
import { z } from "zod";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function registerAuthRoutes(app: Express): void {
  // Register new account
  app.post("/api/auth/register", async (req: any, res) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const { email, password, firstName, lastName } = parsed.data;

      const existing = await authStorage.getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: "An account with this email already exists." });
      }

      const hashed = await bcrypt.hash(password, 10);
      const user = await authStorage.createUser({
        email,
        password: hashed,
        firstName,
        lastName,
        profileImageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(email)}`,
      });

      req.session.userId = user.id;
      const { password: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      console.error("Register error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Login
  app.post("/api/auth/login", async (req: any, res) => {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }
      const { email, password } = parsed.data;

      const user = await authStorage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid email or password." });
      }

      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.status(401).json({ message: "Invalid email or password." });
      }

      req.session.userId = user.id;
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Logout
  app.post("/api/auth/logout", (req: any, res) => {
    req.session.destroy(() => {
      res.json({ message: "Logged out" });
    });
  });

  // Get current authenticated user
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const user = await authStorage.getUser(req.session.userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password: _, ...safeUser } = user as any;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}
