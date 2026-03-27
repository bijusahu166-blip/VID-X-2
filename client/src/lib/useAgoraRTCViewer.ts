import { useEffect, useRef, useState } from "react";
import AgoraRTC, { type IAgoraRTCClient, type IAgoraRTCRemoteUser } from "agora-rtc-sdk-ng";
import { getAgoraAppId } from "./agoraConfig";

AgoraRTC.setLogLevel(4);

interface UseViewerOptions {
  channelName: string;
  videoContainerId: string;
  enabled: boolean;
}

export function useAgoraRTCViewer({ channelName, videoContainerId, enabled }: UseViewerOptions) {
  const [hostOnline, setHostOnline] = useState(false);
  const [connectionState, setConnectionState] = useState<"idle" | "connecting" | "connected" | "failed">("idle");
  const clientRef = useRef<IAgoraRTCClient | null>(null);

  useEffect(() => {
    if (!enabled || !channelName) return;

    let destroyed = false;

    const init = async () => {
      setConnectionState("connecting");
      const appId = await getAgoraAppId();
      if (!appId || destroyed) { setConnectionState("failed"); return; }

      const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
        await client.subscribe(user, mediaType);
        if (destroyed) return;

        if (mediaType === "video" && user.videoTrack) {
          user.videoTrack.play(videoContainerId);
          setHostOnline(true);
        }
        if (mediaType === "audio" && user.audioTrack) {
          user.audioTrack.play();
        }
      });

      client.on("user-unpublished", (_user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
        if (mediaType === "video" && !destroyed) setHostOnline(false);
      });

      client.on("user-left", () => {
        if (!destroyed) setHostOnline(false);
      });

      await client.setClientRole("audience");
      await client.join(appId, channelName, null, null);
      if (!destroyed) setConnectionState("connected");
    };

    init().catch(() => {
      if (!destroyed) setConnectionState("failed");
    });

    return () => {
      destroyed = true;
      clientRef.current?.leave().catch(() => {});
      clientRef.current = null;
      setHostOnline(false);
      setConnectionState("idle");
    };
  }, [channelName, videoContainerId, enabled]);

  return { hostOnline, connectionState };
}
