import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational: boolean = true
  ) {
    super(message);
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  err.statusCode = err.statusCode || 500;
  err.message = err.message || 'Internal Server Error';

  // Logging
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    status: err.statusCode,
    message: err.message,
    userId: (req.session as any)?.userId || 'anonymous',
  };
  console.error('[ERROR]', JSON.stringify(errorLog, null, 2));

  // Drizzle ORM errors
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      error: 'Resource already exists',
      code: 'DUPLICATE_ENTRY',
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      success: false,
      error: 'Resource not found',
      code: 'NOT_FOUND',
    });
  }

  // Cloudinary/Upload errors
  if (err.http_code || err.statusCode === 413) {
    return res.status(400).json({
      success: false,
      error: 'Upload failed',
      code: 'UPLOAD_ERROR',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }

  // Authentication errors
  if (err.statusCode === 401) {
    return res.status(401).json({
      success: false,
      error: err.message || 'Unauthorized',
      code: 'UNAUTHORIZED',
    });
  }

  // Validation errors
  if (err.statusCode === 400) {
    return res.status(400).json({
      success: false,
      error: err.message || 'Bad request',
      code: 'VALIDATION_ERROR',
    });
  }

  // Default error response
  const response = {
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'An error occurred. Please try again later.' 
      : err.message,
    code: 'INTERNAL_SERVER_ERROR',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  res.status(err.statusCode).json(response);
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
