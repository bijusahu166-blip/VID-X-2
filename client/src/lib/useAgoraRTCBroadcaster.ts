import { useEffect, useRef, useCallback, useState } from "react";
import AgoraRTC, { type IAgoraRTCClient, type ILocalVideoTrack, type ILocalAudioTrack } from "agora-rtc-sdk-ng";
import { getAgoraAppId } from "./agoraConfig";

AgoraRTC.setLogLevel(4); // silent in production

interface UseBroadcasterOptions {
  channelName: string;
  enabled: boolean;
  mediaStream: MediaStream | null;
}

export function useAgoraRTCBroadcaster({ channelName, enabled, mediaStream }: UseBroadcasterOptions) {
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const videoTrackRef = useRef<ILocalVideoTrack | null>(null);
  const audioTrackRef = useRef<ILocalAudioTrack | null>(null);
  const [published, setPublished] = useState(false);

  useEffect(() => {
    if (!enabled || !channelName || !mediaStream) return;

    let destroyed = false;

    const init = async () => {
      const appId = await getAgoraAppId();
      if (!appId || destroyed) return;

      const client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      clientRef.current = client;

      await client.setClientRole("host");
      await client.join(appId, channelName, null, null);
      if (destroyed) { await client.leave().catch(() => {}); return; }

      const publishList: (ILocalVideoTrack | ILocalAudioTrack)[] = [];

      const rawVideo = mediaStream.getVideoTracks()[0];
      const rawAudio = mediaStream.getAudioTracks()[0];

      if (rawVideo) {
        const vTrack = AgoraRTC.createCustomVideoTrack({ mediaStreamTrack: rawVideo, frameRate: 30 });
        videoTrackRef.current = vTrack;
        publishList.push(vTrack);
      }

      if (rawAudio) {
        const aTrack = AgoraRTC.createCustomAudioTrack({ mediaStreamTrack: rawAudio });
        audioTrackRef.current = aTrack;
        publishList.push(aTrack);
      }

      if (publishList.length > 0 && !destroyed) {
        await client.publish(publishList);
        setPublished(true);
      }
    };

    init().catch(() => {});

    return () => {
      destroyed = true;
      const cleanup = async () => {
        videoTrackRef.current?.stop();
        videoTrackRef.current?.close();
        audioTrackRef.current?.stop();
        audioTrackRef.current?.close();
        videoTrackRef.current = null;
        audioTrackRef.current = null;
        await clientRef.current?.leave().catch(() => {});
        clientRef.current = null;
        setPublished(false);
      };
      cleanup().catch(() => {});
    };
  }, [channelName, enabled, mediaStream]);

  // Mute / unmute microphone
  const setMuted = useCallback((muted: boolean) => {
    audioTrackRef.current?.setMuted(muted);
  }, []);

  // Enable / disable camera
  const setCameraEnabled = useCallback((enabled: boolean) => {
    videoTrackRef.current?.setMuted(!enabled);
  }, []);

  return { published, setMuted, setCameraEnabled };
}

