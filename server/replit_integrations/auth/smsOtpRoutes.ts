import type { Express } from "express";
import { z } from "zod";
import { supabase } from "../../lib/supabase";
import { smsOtpLimiter } from "../../middleware/rateLimiter";

const sendOtpSchema = z.object({
  phone: z.string().min(10, "Invalid phone number"),
});

const verifyOtpSchema = z.object({
  phone: z.string().min(10, "Invalid phone number"),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

export function registerSmsOtpRoutes(app: Express): void {
  // POST /auth/send-otp - Send OTP to phone number
  app.post("/api/auth/send-otp", smsOtpLimiter, async (req: any, res) => {
    try {
      const parsed = sendOtpSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.errors[0].message });
      }

      const { phone } = parsed.data;

      // Call Supabase to send OTP
      const { data, error } = await supabase.auth.signInWithOtp({
        phone,
      });

      if (error) {
        console.error("Supabase OTP error:", error);
        return res.status(400).json({
          message: error.message || "Failed to send OTP",
        });
      }

      res.json({ message: "OTP sent successfully" });
    } catch (error) {
      console.error("Send OTP error:", error);
      res.status(500).json({ message: "Failed to send OTP" });
    }
  });

  // POST /auth/verify-otp - Verify OTP and create session
  app.post("/api/auth/verify-otp", async (req: any, res) => {
    try {
      const parsed = verifyOtpSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.errors[0].message });
      }

      const { phone, otp } = parsed.data;

      // Call Supabase to verify OTP
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: "sms",
      });

      if (error) {
        console.error("Supabase OTP verification error:", error);
        return res.status(401).json({
          message: error.message || "Invalid or expired OTP",
        });
      }

      // On success, set session and return user
      if (data.session) {
        req.session.userId = data.user?.id;
        await new Promise<void>((resolve, reject) => {
          req.session.save((err: any) => (err ? reject(err) : resolve()));
        });
      }

      res.json({
        message: "OTP verified successfully",
        user: data.user,
        session: data.session,
      });
    } catch (error) {
      console.error("Verify OTP error:", error);
      res.status(500).json({ message: "Failed to verify OTP" });
    }
  });
}
