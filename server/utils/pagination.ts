import { Request, Response } from 'express';

export interface PaginationParams {
  cursor?: string;
  limit?: number;
  offset?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    cursor: string | null;
    limit: number;
    hasMore: boolean;
  };
}

/**
 * Parse pagination params from request query
 */
export function parsePaginationParams(req: Request): PaginationParams {
  const cursor = req.query.cursor as string | undefined;
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 100); // Min 1, max 100
  const offset = parseInt(req.query.offset as string) || 0;

  return {
    cursor,
    limit,
    offset,
  };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  params: PaginationParams,
  hasMore: boolean,
  nextCursor?: string
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      cursor: hasMore ? (nextCursor || data[data.length - 1] as any) : null,
      limit: params.limit || 10,
      hasMore,
    },
  };
}

/**
 * Pagination middleware
 */
export function paginationMiddleware(req: Request, res: Response, next: Function) {
  req.pagination = parsePaginationParams(req);
  next();
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      pagination?: PaginationParams;
    }
  }
}
