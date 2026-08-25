import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

function safeIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];

  if (typeof forwarded === "string") {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]);
  }

  return req.ip || req.socket.remoteAddress || "unknown";
}

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
  skip: (req) =>
    process.env.NODE_ENV !== "production" ||
    req.path.startsWith("/upload"),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many login attempts, please try again later",
  },
  skip: () => process.env.NODE_ENV !== "production",
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Upload limit reached, try again in 1 hour" },
  skip: () => process.env.NODE_ENV !== "production",
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Search rate limit exceeded" },
  skip: () => process.env.NODE_ENV !== "production",
});

export const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Posting limit reached, try again later" },
  skip: () => process.env.NODE_ENV !== "production",
});

// SMS OTP: max 3 requests per 10 minutes per phone number
export const smsOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req: Request) => {
    const phone =
      typeof req.body?.phone === "string"
        ? req.body.phone.trim()
        : "";

    if (phone) {
      return `otp-${phone}`;
    }

    // express-rate-limit v8 expects an IP string, not Request.
    return `otp-ip-${ipKeyGenerator(safeIp(req))}`;
  },

  message: {
    error: "Too many OTP requests. Please try again in 10 minutes.",
  },

  skip: () => process.env.NODE_ENV !== "production",
});