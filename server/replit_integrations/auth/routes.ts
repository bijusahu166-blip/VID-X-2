import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "../../db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

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

function generateUsername(firstName: string, lastName: string): string {
  const base = `${firstName}${lastName}`.toLowerCase().replace(/[^a-z0-9]/g, "");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}${suffix}`;
}

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

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
      const username = generateUsername(firstName, lastName);
      const user = await authStorage.createUser({
        email,
        password: hashed,
        firstName,
        lastName,
        username,
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

  // Login — Step 1: verify password, issue OTP
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

      // Clean up any old OTPs for this user
      await db.execute(sql`DELETE FROM otps WHERE user_id = ${user.id}`);

      // Generate OTP + temp token
      const code = generateOTP();
      const token = generateToken();
      const hashedCode = await bcrypt.hash(code, 8);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      await db.execute(sql`
        INSERT INTO otps (user_id, code, token, expires_at)
        VALUES (${user.id}, ${hashedCode}, ${token}, ${expiresAt.toISOString()})
      `);

      // Return OTP token + the code (in production this would be emailed)
      res.json({
        needsOtp: true,
        otpToken: token,
        otpCode: code,         // shown in UI (simulates email delivery)
        expiresIn: 300,        // seconds
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Login — Step 2: verify OTP, create session
  app.post("/api/auth/verify-otp", async (req: any, res) => {
    try {
      const { otpToken, code } = req.body as { otpToken?: string; code?: string };
      if (!otpToken || !code) {
        return res.status(400).json({ message: "OTP token and code are required." });
      }

      const rows = await db.execute(sql`
        SELECT * FROM otps WHERE token = ${otpToken} AND used = false LIMIT 1
      `);

      const otp = (rows as any).rows?.[0] ?? (rows as any)[0];
      if (!otp) {
        return res.status(401).json({ message: "Invalid or expired security code. Please log in again." });
      }

      // Check expiry
      if (new Date(otp.expires_at) < new Date()) {
        await db.execute(sql`DELETE FROM otps WHERE token = ${otpToken}`);
        return res.status(401).json({ message: "Security code has expired. Please log in again." });
      }

      // Verify code
      const codeMatch = await bcrypt.compare(code, otp.code);
      if (!codeMatch) {
        return res.status(401).json({ message: "Incorrect security code. Please try again." });
      }

      // Mark OTP as used
      await db.execute(sql`UPDATE otps SET used = true WHERE token = ${otpToken}`);

      // Create session
      req.session.userId = otp.user_id;
      const user = await authStorage.getUser(otp.user_id);
      if (!user) return res.status(404).json({ message: "User not found." });

      const { password: _, ...safeUser } = user as any;
      res.json(safeUser);
    } catch (error) {
      console.error("OTP verify error:", error);
      res.status(500).json({ message: "Verification failed" });
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
