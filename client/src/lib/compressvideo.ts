export async function compressVideo(
  file: File,
  targetMB = 95,
  onProgress?: (pct: number) => void
): Promise<File> {
  const targetBytes = targetMB * 1024 * 1024;

  // Already small enough — return as-is
  if (file.size <= targetBytes) return file;

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.muted = true;
    video.preload = "auto";

    video.onloadedmetadata = async () => {
      const duration = video.duration;

      // Calculate target bitrate to hit ~targetMB
      // formula: (targetBytes * 8) / duration = bits per second
      const targetBitsPerSec = Math.floor((targetBytes * 8) / duration);
      const videoBitrate = Math.min(
        Math.floor(targetBitsPerSec * 0.88), // 88% for video
        2_500_000 // max 2.5Mbps
      );
      const audioBitrate = 96_000; // 96kbps audio

      // Setup canvas for video frames
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      // Scale down resolution if needed
      const maxWidth = 1280;
      const maxHeight = 720;
      const scale = Math.min(
        maxWidth / video.videoWidth,
        maxHeight / video.videoHeight,
        1
      );
      canvas.width = Math.floor(video.videoWidth * scale);
      canvas.height = Math.floor(video.videoHeight * scale);

      // Capture canvas stream
      const canvasStream = canvas.captureStream(30); // 30fps

      // Add audio from video element
      let audioCtx: AudioContext | null = null;
      try {
        audioCtx = new AudioContext();
        const src = audioCtx.createMediaElementSource(video);
        const dest = audioCtx.createMediaStreamDestination();
        src.connect(dest);
        src.connect(audioCtx.destination);
        dest.stream.getAudioTracks().forEach(t => canvasStream.addTrack(t));
      } catch {
        // Audio capture failed — video only (silent)
      }

      // Pick best supported codec
      const mimeTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/webm",
      ];
      const mimeType = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || "video/webm";

      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(canvasStream, {
          mimeType,
          videoBitsPerSecond: videoBitrate,
          audioBitsPerSecond: audioBitrate,
        });
      } catch {
        // MediaRecorder config failed — return original
        URL.revokeObjectURL(objectUrl);
        return resolve(file);
      }

      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.onstop = () => {
        URL.revokeObjectURL(objectUrl);
        audioCtx?.close();
        canvasStream.getTracks().forEach(t => t.stop());

        const compressed = new Blob(chunks, { type: mimeType });

        // If compression made it bigger (rare), use original
        const result = compressed.size < file.size
          ? new File([compressed], file.name.replace(/\.[^.]+$/, "") + "_compressed.webm", { type: mimeType })
          : file;

        resolve(result);
      };

      recorder.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file); // fallback
      };

      // Draw frames to canvas in real-time
      let lastProgress = 0;
      const drawFrame = () => {
        if (video.paused || video.ended) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const pct = Math.min(Math.floor((video.currentTime / duration) * 100), 99);
        if (pct !== lastProgress) {
          lastProgress = pct;
          onProgress?.(pct);
        }
        requestAnimationFrame(drawFrame);
      };

      recorder.start(250); // collect data every 250ms
      video.play();
      video.onplay = () => drawFrame();

      video.onended = () => {
        recorder.stop();
        onProgress?.(100);
      };

      // Safety timeout
      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, (duration + 10) * 1000);
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // fallback — upload original
    };

    video.load();
  });
}
