import { compressVideo } from "@/lib/compressvideo";

// ─── Background Upload Manager ───────────────────────────────────────────
// Runs compression + chunked upload OUTSIDE the dialog's React state,
// so closing the dialog (or opening it again for another video) never
// cancels or blocks an in-progress upload. Multiple uploads can run
// at the same time — each tracked by its own id.

export type UploadStatus = "compressing" | "uploading" | "finalizing" | "done" | "error";

export interface UploadTask {
  id: string;
  fileName: string;
  status: UploadStatus;
  progress: number; // 0-100
  error?: string;
  videoUrl?: string;
}

type Listener = (tasks: UploadTask[]) => void;

const tasks = new Map<string, UploadTask>();
const listeners = new Set<Listener>();

function emit() {
  const list = Array.from(tasks.values());
  listeners.forEach((l) => l(list));
}

export function subscribeUploads(listener: Listener): () => void {
  listeners.add(listener);
  listener(Array.from(tasks.values()));
  return () => listeners.delete(listener);
}

function updateTask(id: string, patch: Partial<UploadTask>) {
  const t = tasks.get(id);
  if (!t) return;
  Object.assign(t, patch);
  emit();
  // auto-clean finished tasks after a short delay so the UI can show "done"
  if (patch.status === "done" || patch.status === "error") {
    setTimeout(() => {
      tasks.delete(id);
      emit();
    }, 4000);
  }
}

// Chunk upload settings — tuned for smoother, faster concurrent uploads
const CHUNK_SIZE = 1 * 1024 * 1024; // 1 MB
const CONCURRENCY = 6; // parallel chunk uploads per file
const MAX_RETRIES = 3;

// ─── Hard server/plan limit ────────────────────────────────────────────────
// The hosting plan REJECTS any file over 100MB — this isn't optional, so we
// must guarantee the file we hand to uploadFileChunks is under this size,
// even if that means compressing multiple times with lower and lower targets.
const SERVER_HARD_LIMIT_MB = 80;
const SAFE_TARGET_MB = 30; // leave a buffer under the hard limit
const MAX_COMPRESSION_PASSES = 4;

/**
 * Compresses a file, then re-checks the actual output size. If it's still
 * over the safe target (compressVideo's bitrate estimate can be off), it
 * compresses again with a lower target — up to MAX_COMPRESSION_PASSES times.
 * Guarantees the returned file is under SAFE_TARGET_MB, or throws if it
 * truly cannot be brought down further (e.g. compression isn't supported
 * in this browser).
 */
async function compressUntilUnderLimit(
  file: File,
  onProgress: (pct: number) => void
): Promise<File> {
  let current = file;
  let targetMB = SAFE_TARGET_MB;

  for (let pass = 0; pass < MAX_COMPRESSION_PASSES; pass++) {
    const sizeMB = current.size / (1024 * 1024);
    if (sizeMB <= SAFE_TARGET_MB) return current; // already safe

    const passStart = pass / MAX_COMPRESSION_PASSES;
    const passEnd = (pass + 1) / MAX_COMPRESSION_PASSES;

    const result = await compressVideo(current, targetMB, (pct) => {
      onProgress(Math.round((passStart + (pct / 100) * (passEnd - passStart)) * 100));
    });

    // compressVideo() falls back to returning the original file if the
    // browser can't compress (unsupported codec, capture error, etc.) —
    // detect that "no progress" case so we don't loop forever.
    if (result.size >= current.size) {
      if (current.size / (1024 * 1024) <= SERVER_HARD_LIMIT_MB) {
        return current; // under hard limit even if not under the safe target
      }
      throw new Error(
        "Could not compress this video small enough for upload. Try a shorter clip or lower original resolution."
      );
    }

    current = result;
    // Push the target lower each pass in case the previous pass overshot
    targetMB = Math.max(40, targetMB - 20);
  }

  const finalSizeMB = current.size / (1024 * 1024);
  if (finalSizeMB > SERVER_HARD_LIMIT_MB) {
    throw new Error(
      "This video is too large to compress under the upload limit. Try a shorter clip or lower original resolution."
    );
  }
  return current;
}

async function uploadFileChunks(
  file: File,
  onProgress: (pct: number) => void
): Promise<string> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let completedChunks = 0;
  let aborted = false;
  let abortReason = "";

  const uploadChunk = async (i: number): Promise<void> => {
    if (aborted) return;
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (aborted) return;
      try {
        const fd = new FormData();
        fd.append("uploadId", uploadId);
        fd.append("chunkIndex", String(i));
        fd.append("totalChunks", String(totalChunks));
        fd.append("chunk", chunk, file.name);

        const resp = await fetch("/api/upload/chunk", {
          method: "POST",
          body: fd,
          credentials: "include",
        });

        if (resp.ok) {
          completedChunks++;
          onProgress(Math.round((completedChunks / totalChunks) * 90));
          return;
        }

        let msg = `HTTP ${resp.status}`;
        try { msg = (await resp.json()).message || msg; } catch {}

        if (attempt === MAX_RETRIES - 1) {
          aborted = true;
          abortReason = `${msg} (chunk ${i + 1}/${totalChunks})`;
        } else {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        }
      } catch (err: any) {
        if (attempt === MAX_RETRIES - 1) {
          aborted = true;
          abortReason = `Network error on chunk ${i + 1}/${totalChunks}: ${err?.message || "connection lost"}`;
        } else {
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
    }
  };

  for (let batch = 0; batch < totalChunks; batch += CONCURRENCY) {
    if (aborted) break;
    const batchIndices = Array.from(
      { length: Math.min(CONCURRENCY, totalChunks - batch) },
      (_, k) => batch + k
    );
    await Promise.all(batchIndices.map(uploadChunk));
  }

  if (aborted) throw new Error(abortReason);

  onProgress(92);
  const finalResp = await fetch("/api/upload/finalize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ uploadId, totalChunks, originalName: file.name }),
  });

  if (!finalResp.ok) {
    let msg = "Failed to assemble video";
    try { msg = (await finalResp.json()).message || msg; } catch {}
    throw new Error(msg);
  }

  const finalData = await finalResp.json();
  onProgress(100);
  return finalData.url;
}

/**
 * Kicks off compression + upload for one video in the background.
 * Does NOT block — caller can close the dialog immediately and start
 * another upload right away. Runs independently of any component's
 * mount/unmount lifecycle.
 *
 * onDone is called with the final Cloudinary video URL once ready —
 * use it to create the actual post (call your createPost mutation there).
 */
export function startBackgroundVideoUpload(
  file: File,
  onDone: (videoUrl: string) => void,
  onError: (err: string) => void
): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  tasks.set(id, {
    id,
    fileName: file.name,
    status: "compressing",
    progress: 0,
  });
  emit();

  (async () => {
    try {
      let finalFile = file;

      // Compress if bigger than 20MB — guarantees output is under the
      // server's hard 100MB limit, retrying with lower targets if needed.
      if (file.size > 20 * 1024 * 1024) {
        finalFile = await compressUntilUnderLimit(file, (pct) => {
          updateTask(id, { status: "compressing", progress: Math.round(pct * 0.3) }); // compression = first 30%
        });
      }

      updateTask(id, { status: "uploading", progress: 30 });
      const videoUrl = await uploadFileChunks(finalFile, (pct) => {
        // uploading = remaining 70%
        updateTask(id, { status: "uploading", progress: 30 + Math.round(pct * 0.7) });
      });

      updateTask(id, { status: "done", progress: 100, videoUrl });
      onDone(videoUrl);
    } catch (err: any) {
      const msg = err?.message || "Upload failed";
      updateTask(id, { status: "error", progress: 0, error: msg });
      onError(msg);
    }
  })();

  return id;
}