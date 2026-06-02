import { Request, Response, NextFunction } from "express";
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session || !(req.session as any).userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  next();
};
export const authMiddleware = requireAuth;
