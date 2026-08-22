export async function compressVideo(
  file: File,
  targetMB = 100,
  onProgress?: (pct: number) => void
): Promise<File> {
  const targetBytes = targetMB * 1024 * 1024;

  // Already under target — don't compress
  if (file.size <= targetBytes) {
    onProgress?.(100);
    return file;
  }

  return new Promise((resolve) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    let finished = false;

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
    };

    const finish = (result: File) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(result);
    };

    video.src = objectUrl;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    video.onloadedmetadata = async () => {
      try {
        const duration = video.duration;

        if (!Number.isFinite(duration) || duration <= 0) {
          finish(file);
          return;
        }

        // ----------------------------------------------------
        // TARGET TOTAL BITRATE
        // ----------------------------------------------------
        const targetTotalBitsPerSecond =
          (targetBytes * 8) / duration;

        // Keep audio small so total stays close to target
        const audioBitrate = 64_000;

        // Reserve audio bitrate first
        const availableVideoBitrate =
          targetTotalBitsPerSecond - audioBitrate;

        // Use 90% of available bitrate for safety
        const videoBitrate = Math.max(
          100_000,
          Math.min(
            Math.floor(availableVideoBitrate * 0.9),
            2_500_000
          )
        );

        // ----------------------------------------------------
        // RESOLUTION
        // ----------------------------------------------------
        const maxWidth = 1280;
        const maxHeight = 720;

        const sourceWidth = video.videoWidth || 1280;
        const sourceHeight = video.videoHeight || 720;

        const scale = Math.min(
          maxWidth / sourceWidth,
          maxHeight / sourceHeight,
          1
        );

        let width = Math.floor(sourceWidth * scale);
        let height = Math.floor(sourceHeight * scale);

        // Canvas dimensions should be even
        width = width - (width % 2);
        height = height - (height % 2);

        canvasSetup:
        {
          // no-op label
        }

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(width, 2);
        canvas.height = Math.max(height, 2);

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          finish(file);
          return;
        }

        const canvasStream = canvas.captureStream(30);

        // ----------------------------------------------------
        // AUDIO
        // ----------------------------------------------------
        let audioContext: AudioContext | null = null;

        try {
          audioContext = new AudioContext();

          const source =
            audioContext.createMediaElementSource(video);

          const destination =
            audioContext.createMediaStreamDestination();

          source.connect(destination);

          // Don't play compressed audio through speakers
          // while compression is running.
          destination.stream
            .getAudioTracks()
            .forEach((track) => {
              canvasStream.addTrack(track);
            });
        } catch (error) {
          console.warn(
            "Audio capture unavailable:",
            error
          );
        }

        // ----------------------------------------------------
        // CODEC
        // ----------------------------------------------------
        const mimeTypes = [
          "video/webm;codecs=vp9,opus",
          "video/webm;codecs=vp8,opus",
          "video/webm;codecs=vp9",
          "video/webm;codecs=vp8",
          "video/webm",
        ];

        const mimeType =
          mimeTypes.find((type) =>
            MediaRecorder.isTypeSupported(type)
          ) || "video/webm";

        let recorder: MediaRecorder;

        try {
          recorder = new MediaRecorder(canvasStream, {
            mimeType,
            videoBitsPerSecond: videoBitrate,
            audioBitsPerSecond: audioBitrate,
          });
        } catch (error) {
          console.error(
            "MediaRecorder initialization failed:",
            error
          );

          audioContext?.close();
          canvasStream.getTracks().forEach((track) => {
            track.stop();
          });

          finish(file);
          return;
        }

        const chunks: Blob[] = [];

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            chunks.push(event.data);
          }
        };

        recorder.onerror = (event) => {
          console.error(
            "MediaRecorder error:",
            event
          );

          audioContext?.close();

          canvasStream.getTracks().forEach((track) => {
            track.stop();
          });

          finish(file);
        };

        recorder.onstop = () => {
          audioContext?.close();

          canvasStream.getTracks().forEach((track) => {
            track.stop();
          });

          const compressedBlob = new Blob(chunks, {
            type: mimeType,
          });

          // If compression failed or became bigger,
          // use original file.
          if (
            compressedBlob.size <= 0 ||
            compressedBlob.size >= file.size
          ) {
            finish(file);
            return;
          }

          const extension =
            mimeType.includes("webm")
              ? "webm"
              : "mp4";

          const baseName = file.name.replace(
            /\.[^/.]+$/,
            ""
          );

          const compressedFile = new File(
            [compressedBlob],
            `${baseName}_compressed.${extension}`,
            {
              type: mimeType,
              lastModified: Date.now(),
            }
          );

          onProgress?.(100);

          finish(compressedFile);
        };

        // ----------------------------------------------------
        // DRAW VIDEO FRAMES
        // ----------------------------------------------------
        let animationFrame = 0;
        let lastProgress = -1;

        const drawFrame = () => {
          if (
            recorder.state !== "recording" ||
            video.ended
          ) {
            return;
          }

          try {
            ctx.drawImage(
              video,
              0,
              0,
              canvas.width,
              canvas.height
            );
          } catch (error) {
            console.warn(
              "Frame drawing failed:",
              error
            );
          }

          const progress = Math.min(
            99,
            Math.floor(
              (video.currentTime / duration) * 100
            )
          );

          if (progress !== lastProgress) {
            lastProgress = progress;
            onProgress?.(progress);
          }

          animationFrame =
            requestAnimationFrame(drawFrame);
        };

        recorder.start(250);

        try {
          await video.play();
        } catch (error) {
          console.error(
            "Video playback failed:",
            error
          );

          cancelAnimationFrame(animationFrame);

          if (recorder.state === "recording") {
            recorder.stop();
          }

          return;
        }

        drawFrame();

        video.onended = () => {
          cancelAnimationFrame(animationFrame);

          if (recorder.state === "recording") {
            recorder.stop();
          }
        };

        // Safety timeout
        const safetyTimeout = window.setTimeout(() => {
          cancelAnimationFrame(animationFrame);

          if (recorder.state === "recording") {
            recorder.stop();
          }
        }, (duration + 15) * 1000);

        const originalOnStop = recorder.onstop;

        recorder.onstop = (event) => {
          window.clearTimeout(safetyTimeout);

          if (originalOnStop) {
            originalOnStop.call(recorder, event);
          }
        };
      } catch (error) {
        console.error(
          "Video compression failed:",
          error
        );

        finish(file);
      }
    };

    video.onerror = () => {
      console.error(
        "Could not read video file."
      );

      finish(file);
    };

    video.load();
  });
}