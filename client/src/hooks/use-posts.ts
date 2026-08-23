import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { api, buildUrl } from "@shared/routes";
import { z } from "zod";
import {
  insertPostSchema,
  insertCommentSchema,
} from "@shared/schema";

import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/models/auth";

/* ============================================================
   TYPES
============================================================ */

type Post = z.infer<
  typeof api.posts.create.responses[201]
>;

export interface EnrichedPost extends Post {
  user: User | undefined;
  likesCount: number;
  commentsCount: number;
  hasLiked: boolean;
}

/* ============================================================
   SAFE API RESPONSE NORMALIZER

   Backend may return:

   1. [...]
   2. { posts: [...] }
   3. { data: [...] }
   4. { items: [...] }
   5. { results: [...] }
   6. { rows: [...] }

   We ALWAYS return an array.

   This prevents:
   "n?.map is not a function"
============================================================ */

function normalizePostsResponse(
  response: unknown
): EnrichedPost[] {
  // ----------------------------------------------------------
  // API directly returned an array
  // ----------------------------------------------------------

  if (Array.isArray(response)) {
    return response as EnrichedPost[];
  }

  // ----------------------------------------------------------
  // Invalid / empty response
  // ----------------------------------------------------------

  if (
    response === null ||
    response === undefined ||
    typeof response !== "object"
  ) {
    return [];
  }

  const data = response as Record<
    string,
    unknown
  >;

  // ----------------------------------------------------------
  // { posts: [...] }
  // ----------------------------------------------------------

  if (Array.isArray(data.posts)) {
    return data.posts as EnrichedPost[];
  }

  // ----------------------------------------------------------
  // { data: [...] }
  // ----------------------------------------------------------

  if (Array.isArray(data.data)) {
    return data.data as EnrichedPost[];
  }

  // ----------------------------------------------------------
  // { items: [...] }
  // ----------------------------------------------------------

  if (Array.isArray(data.items)) {
    return data.items as EnrichedPost[];
  }

  // ----------------------------------------------------------
  // { results: [...] }
  // ----------------------------------------------------------

  if (Array.isArray(data.results)) {
    return data.results as EnrichedPost[];
  }

  // ----------------------------------------------------------
  // { rows: [...] }
  // ----------------------------------------------------------

  if (Array.isArray(data.rows)) {
    return data.rows as EnrichedPost[];
  }

  // ----------------------------------------------------------
  // Unexpected response
  // ----------------------------------------------------------

  console.error(
    "[usePosts] Unexpected /api/posts response:",
    response
  );

  return [];
}

/* ============================================================
   GET ALL POSTS

   IMPORTANT:

   initialData: []

   Iska matlab component ko first render par bhi
   array milega.

   Isliye:
   posts.map(...)
   posts.filter(...)

   safe rahenge.

   Network request background mein chalegi.
============================================================ */

export function usePosts() {
  return useQuery<EnrichedPost[]>({
    queryKey: [api.posts.list.path],

    queryFn: async () => {
      try {
        const res = await fetch(
          api.posts.list.path,
          {
            credentials: "include",

            headers: {
              Accept:
                "application/json",
            },
          }
        );

        if (!res.ok) {
          throw new Error(
            `Failed to fetch posts (${res.status})`
          );
        }

        const json: unknown =
          await res.json();

        // ALWAYS return array
        return normalizePostsResponse(
          json
        );
      } catch (error) {
        console.error(
          "[usePosts] Fetch error:",
          error
        );

        throw error;
      }
    },

    /*
     * IMPORTANT
     *
     * Page ko undefined nahi milega.
     * Initial render par [] milega.
     *
     * Isse unnecessary loading screen avoid
     * karne mein help milegi.
     */
    initialData: [],

    /*
     * Data ko 30 seconds tak fresh maana jayega.
     */
    staleTime: 30_000,

    /*
     * Cache 5 minutes tak rakho.
     */
    gcTime: 5 * 60_000,

    /*
     * Window active hone par background refresh.
     */
    refetchOnWindowFocus: true,

    /*
     * Component mount hone par agar cached data
     * available hai to background refresh.
     */
    refetchOnMount: true,

    /*
     * Agar network fail ho to retry.
     */
    retry: 3,

    retryDelay: (attempt) =>
      1000 * (attempt + 1),
  });
}

/* ============================================================
   GET SINGLE POST
============================================================ */

export function usePost(id: number) {
  return useQuery<Post>({
    queryKey: [
      api.posts.get.path,
      id,
    ],

    queryFn: async () => {
      const url = buildUrl(
        api.posts.get.path,
        {
          id,
        }
      );

      const res = await fetch(
        url,
        {
          credentials: "include",

          headers: {
            Accept:
              "application/json",
          },
        }
      );

      if (!res.ok) {
        throw new Error(
          `Failed to fetch post (${res.status})`
        );
      }

      const json: unknown =
        await res.json();

      /*
       * Support:
       *
       * { post: {...} }
       *
       * as well as:
       *
       * {...}
       */

      if (
        json &&
        typeof json === "object" &&
        !Array.isArray(json) &&
        "post" in json
      ) {
        return (
          json as {
            post: Post;
          }
        ).post;
      }

      return json as Post;
    },

    enabled:
      Number.isFinite(id) &&
      id > 0,
  });
}

/* ============================================================
   CREATE POST
============================================================ */

export function useCreatePost() {
  const queryClient =
    useQueryClient();

  const { toast } =
    useToast();

  return useMutation({
    mutationFn: async (
      data: z.infer<
        typeof insertPostSchema
      >
    ) => {
      const res = await fetch(
        api.posts.create.path,
        {
          method:
            api.posts.create.method,

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify(data),

          credentials:
            "include",
        }
      );

      if (!res.ok) {
        let message =
          "Failed to create post.";

        try {
          const error =
            await res.json();

          if (
            error &&
            typeof error === "object" &&
            "message" in error
          ) {
            message = String(
              (
                error as {
                  message: unknown;
                }
              ).message
            );
          }
        } catch {
          // Keep default error message
        }

        throw new Error(message);
      }

      return await res.json();
    },

    onSuccess: async () => {
      /*
       * Refresh posts everywhere:
       *
       * Home
       * Search
       * Reels
       * Profile
       */

      await queryClient.invalidateQueries({
        queryKey: [
          api.posts.list.path,
        ],
      });

      toast({
        title: "Posted!",
        description:
          "Your post is now live.",
      });
    },

    onError: (error: Error) => {
      toast({
        title: "Error",
        description:
          error.message ||
          "Failed to create post. Please try again.",
        variant:
          "destructive",
      });
    },
  });
}

/* ============================================================
   LIKE POST
============================================================ */

export function useLikePost() {
  const queryClient =
    useQueryClient();

  return useMutation({
    mutationFn: async (
      postId: number
    ) => {
      const url = buildUrl(
        api.posts.like.path,
        {
          id: postId,
        }
      );

      const res = await fetch(
        url,
        {
          method:
            api.posts.like.method,

          credentials:
            "include",

          headers: {
            Accept:
              "application/json",
          },
        }
      );

      if (!res.ok) {
        throw new Error(
          "Failed to like post"
        );
      }

      return await res.json();
    },

    onSuccess: async (
      _data,
      postId
    ) => {
      /*
       * Update feed
       */

      await queryClient.invalidateQueries({
        queryKey: [
          api.posts.list.path,
        ],
      });

      /*
       * Update individual post
       */

      await queryClient.invalidateQueries({
        queryKey: [
          api.posts.get.path,
          postId,
        ],
      });
    },
  });
}

/* ============================================================
   ADD COMMENT
============================================================ */

export function useAddComment() {
  const queryClient =
    useQueryClient();

  const { toast } =
    useToast();

  return useMutation({
    mutationFn: async ({
      postId,
      content,
    }: {
      postId: number;
      content: string;
    }) => {
      const url = buildUrl(
        api.posts.comment.path,
        {
          id: postId,
        }
      );

      const res = await fetch(
        url,
        {
          method:
            api.posts.comment.method,

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",
          },

          body: JSON.stringify({
            content,
          }),

          credentials:
            "include",
        }
      );

      if (!res.ok) {
        throw new Error(
          "Failed to add comment"
        );
      }

      return await res.json();
    },

    onSuccess: async (
      _data,
      variables
    ) => {
      /*
       * Refresh feed
       */

      await queryClient.invalidateQueries({
        queryKey: [
          api.posts.list.path,
        ],
      });

      /*
       * Refresh individual post
       */

      await queryClient.invalidateQueries({
        queryKey: [
          api.posts.get.path,
          variables.postId,
        ],
      });

      toast({
        title: "Comment added",
      });
    },

    onError: () => {
      toast({
        title: "Error",
        description:
          "Failed to add comment. Please try again.",
        variant:
          "destructive",
      });
    },
  });
}