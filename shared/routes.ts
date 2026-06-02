import { z } from 'zod';
import { insertPostSchema, insertCommentSchema, posts, comments } from './schema';

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  posts: {
    list: {
      method: 'GET' as const,
      path: '/api/posts' as const,
      responses: {
        200: z.array(z.custom<any>()), // Using any for complex relation types for now to avoid circular deps
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/posts' as const,
      input: insertPostSchema,
      responses: {
        201: z.custom<typeof posts.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/posts/:id' as const,
      responses: {
        200: z.custom<any>(),
        404: errorSchemas.notFound,
      },
    },
    like: {
      method: 'POST' as const,
      path: '/api/posts/:id/like' as const,
      responses: {
        200: z.object({ success: z.boolean(), likesCount: z.number() }),
        404: errorSchemas.notFound,
      },
    },
    comment: {
      method: 'POST' as const,
      path: '/api/posts/:id/comments' as const,
      input: z.object({ content: z.string() }),
      responses: {
        201: z.custom<typeof comments.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    }
  },
  users: {
    get: {
      method: 'GET' as const,
      path: '/api/users/:id' as const,
      responses: {
        200: z.custom<any>(),
        404: errorSchemas.notFound,
      },
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
