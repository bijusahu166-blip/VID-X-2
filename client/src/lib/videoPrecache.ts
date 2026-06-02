import { toCloudinaryVideoUrl } from "./utils";

/**
 * Video Pre-cache Manager
 *
 * Silently fetches the first 3 MB of each video URL into the browser's HTTP
 * cache while the current video plays.  When the user swipes to the next reel
 * (or scrolls to the next video post) the browser serves it straight from
 * cache — zero wait time on first frame.
 *
 * Design constraints:
 *  - Max 2 concurrent prefetch requests so we don't saturate the connection
 *  - Each URL is only fetched once per session (tracked by `fetched`)
 *  - Errors are swallowed silently — this is a best-effort optimisation
 *  - Respects the browser's own Cache-Control / Vary rules; if the server
 *    says don't cache, subsequent real requests will re-fetch anyway
 */

const PREFETCH_BYTES = 3 * 1024 * 1024; // 3 MB — ~3–5 s of typical 720p video
const MAX_CONCURRENT = 2;

const fetched = new Set<string>();
let active = 0;
const queue: string[] = [];

function runNext() {
  if (active >= MAX_CONCURRENT || queue.length === 0) return;
  const url = queue.shift()!;
  active++;

  fetch(url, {
    method: "GET",
    headers: { Range: `bytes=0-${PREFETCH_BYTES - 1}` },
    credentials: "omit",
    mode: "cors",
    cache: "default", // store in HTTP cache
  })
    .catch(() => {}) // silently ignore network errors
    .finally(() => {
      active--;
      runNext();
    });
}

/**
 * Schedule a video URL for background pre-caching.
 * Safe to call multiple times with the same URL — deduped automatically.
 */
export function precacheVideo(rawUrl: string): void {
  if (!rawUrl) return;
  const url = toCloudinaryVideoUrl(rawUrl);
  if (fetched.has(url)) return;
  fetched.add(url);
  queue.push(url);
  runNext();
}

/**
 * Pre-cache multiple URLs at once (e.g. next 2 reels).
 */
export function precacheVideos(rawUrls: (string | null | undefined)[]): void {
  for (const u of rawUrls) {
    if (u) precacheVideo(u);
  }
}
