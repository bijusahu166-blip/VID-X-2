import { apiUrl } from "@/lib/queryClient";
/**
 * Background video uploader.
 *
 * IMPORTANT:
 * - No client-side video compression/transcoding.
 * - Original audio + video stream is uploaded unchanged.
 * - Videos are uploaded in 1 MB chunks with per-file parallelism.
 * - Multiple files can upload independently in the background.
 */
export type UploadStatus = "uploading" | "finalizing" | "done" | "error";

export interface UploadTask {
  id: string;
  fileName: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  videoUrl?: string;
}

type Listener = (tasks: UploadTask[]) => void;

const tasks = new Map<string, UploadTask>();
const listeners = new Set<Listener>();

const CHUNK_SIZE = 1 * 1024 * 1024;
const CONCURRENCY = 6;
const MAX_RETRIES = 4;

function emit() {
  listeners.forEach((listener) => listener(Array.from(tasks.values())));
}

export function subscribeUploads(listener: Listener): () => void {
  listeners.add(listener);
  listener(Array.from(tasks.values()));
  return () => listeners.delete(listener);
}

function updateTask(id: string, patch: Partial<UploadTask>) {
  const task = tasks.get(id);
  if (!task) return;

  Object.assign(task, patch);
  emit();

  if (patch.status === "done" || patch.status === "error") {
    window.setTimeout(() => {
      tasks.delete(id);
      emit();
    }, 5000);
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function readError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return String(data?.message || `HTTP ${response.status}`);
  } catch {
    return `HTTP ${response.status}`;
  }
}

async function uploadFileChunks(
  file: File,
  onProgress: (percent: number) => void,
): Promise<string> {
  const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;

  let completed = 0;
  let failed = false;
  let failureMessage = "";

  const uploadChunk = async (index: number) => {
    if (failed) return;

    const start = index * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      if (failed) return;

      try {
        const form = new FormData();
        form.append("uploadId", uploadId);
        form.append("chunkIndex", String(index));
        form.append("totalChunks", String(totalChunks));
        form.append("chunk", chunk, file.name);

        const response = await fetch(apiUrl("/api/upload/chunk"), {
          method: "POST",
          body: form,
          credentials: "include",
        });

        if (response.ok) {
          completed += 1;
          onProgress(Math.round((completed / totalChunks) * 92));
          return;
        }

        const message = await readError(response);
        if (attempt === MAX_RETRIES - 1) {
          failed = true;
          failureMessage = `${message} (chunk ${index + 1}/${totalChunks})`;
          return;
        }

        await wait(600 * (attempt + 1));
      } catch (error: any) {
        if (attempt === MAX_RETRIES - 1) {
          failed = true;
          failureMessage =
            `Network error on chunk ${index + 1}/${totalChunks}: ` +
            (error?.message || "connection lost");
          return;
        }

        await wait(800 * (attempt + 1));
      }
    }
  };

  for (let start = 0; start < totalChunks; start += CONCURRENCY) {
    if (failed) break;

    const batch = Array.from(
      { length: Math.min(CONCURRENCY, totalChunks - start) },
      (_, offset) => start + offset,
    );

    await Promise.all(batch.map(uploadChunk));
  }

  if (failed) {
    throw new Error(failureMessage || "Video upload failed");
  }

  onProgress(94);
  const finalizeResponse = await fetch(apiUrl("/api/upload/finalize"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      uploadId,
      totalChunks,
      originalName: file.name,
    }),
  });

  if (!finalizeResponse.ok) {
    throw new Error(await readError(finalizeResponse));
  }

  const data = await finalizeResponse.json();
  const url = String(data?.url || data?.videoUrl || "");

  if (!url) {
    throw new Error("Server did not return a video URL");
  }

  onProgress(100);
  return url;
}

/**
 * Starts upload immediately and returns a task id.
 * The caller may close/unmount its dialog; the upload continues independently.
 */
export function startBackgroundVideoUpload(
  file: File,
  onDone: (videoUrl: string) => void | Promise<void>,
  onError: (error: string) => void,
): string {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  tasks.set(id, {
    id,
    fileName: file.name,
    status: "uploading",
    progress: 0,
  });
  emit();

  (async () => {
    try {
      updateTask(id, { status: "uploading", progress: 1 });

      const videoUrl = await uploadFileChunks(file, (progress) => {
        updateTask(id, {
          status: progress >= 94 ? "finalizing" : "uploading",
          progress,
        });
      });

      updateTask(id, {
        status: "done",
        progress: 100,
        videoUrl,
      });

      await onDone(videoUrl);
    } catch (error: any) {
      const message = error?.message || "Video upload failed";
      updateTask(id, {
        status: "error",
        progress: 0,
        error: message,
      });
      onError(message);
    }
  })();

  return id;
}
