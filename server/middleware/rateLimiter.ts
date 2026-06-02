import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Request } from 'express';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: () => process.env.NODE_ENV !== 'production',
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts, please try again later' },
  skip: () => process.env.NODE_ENV !== 'production',
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload limit reached, try again in 1 hour' },
  skip: () => process.env.NODE_ENV !== 'production',
});

export const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Search rate limit exceeded' },
  skip: () => process.env.NODE_ENV !== 'production',
});

export const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Posting limit reached, try again later' },
  skip: () => process.env.NODE_ENV !== 'production',
});

// Rate limiter for SMS OTP: max 3 requests per 10 minutes per phone number
export const smsOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use phone number from request body as the key
    const phone = (req.body?.phone as string) || '';
    // If no phone provided, fall back to IP address
    return phone ? `otp-${phone}` : ipKeyGenerator(req);
  },
  message: { error: 'Too many OTP requests. Please try again in 10 minutes.' },
  skip: () => process.env.NODE_ENV !== 'production',
});