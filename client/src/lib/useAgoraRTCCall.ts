/**
 * Agora RTC P2P call hook — "rtc" mode where both participants are hosts.
 * Both users join the same channel, publish local video+audio, and subscribe
 * to each other's tracks automatically.
 *
 * Usage:
 *   const { remoteVideoRef, localVideoRef, joined, setMuted, setCameraOn, leave }
 *     = useAgoraRTCCall({ channelName, localVideoEl, enabled });
 */
import { useEffect, useRef, useState, useCallback } from "react";
import AgoraRTC, {
  type IAgoraRTCClient,
  type IAgoraRTCRemoteUser,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import { getAgoraAppId } from "./agoraConfig";

AgoraRTC.setLogLevel(4);

interface UseAgoraRTCCallOptions {
  channelName: string;
  localVideoContainerId: string;
  remoteVideoContainerId: string;
  enabled: boolean;
  facingMode?: "user" | "environment";
}

export function useAgoraRTCCall({
  channelName,
  localVideoContainerId,
  remoteVideoContainerId,
  enabled,
  facingMode = "user",
}: UseAgoraRTCCallOptions) {
  const [joined, setJoined] = useState(false);
  const [hasRemote, setHasRemote] = useState(false);
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const videoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const audioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);

  useEffect(() => {
    if (!enabled || !channelName) return;
    let destroyed = false;

    const init = async () => {
      const appId = await getAgoraAppId();
      if (!appId || destroyed) return;

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
        await client.subscribe(user, mediaType);
        if (destroyed) return;
        if (mediaType === "video" && user.videoTrack) {
          user.videoTrack.play(remoteVideoContainerId);
          setHasRemote(true);
        }
        if (mediaType === "audio" && user.audioTrack) {
          user.audioTrack.play();
        }
      });

      client.on("user-unpublished", (_u: IAgoraRTCRemoteUser, mediaType: "audio" | "video") => {
        if (mediaType === "video" && !destroyed) setHasRemote(false);
      });

      client.on("user-left", () => { if (!destroyed) setHasRemote(false); });

      await client.join(appId, channelName, null, null);

      const [aTrack, vTrack] = await Promise.all([
        AgoraRTC.createMicrophoneAudioTrack().catch(() => null),
        AgoraRTC.createCameraVideoTrack({ facingMode }).catch(() => null),
      ]);

      if (destroyed) {
        aTrack?.stop(); aTrack?.close();
        vTrack?.stop(); vTrack?.close();
        await client.leave().catch(() => {});
        return;
      }

      audioTrackRef.current = aTrack;
      videoTrackRef.current = vTrack;

      const toPublish = [aTrack, vTrack].filter(Boolean) as (ICameraVideoTrack | IMicrophoneAudioTrack)[];
      if (toPublish.length) await client.publish(toPublish);

      if (vTrack) vTrack.play(localVideoContainerId);

      setJoined(true);
    };

    init().catch(() => { if (!destroyed) setJoined(false); });

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
        setJoined(false);
        setHasRemote(false);
      };
      cleanup();
    };
  }, [channelName, enabled, localVideoContainerId, remoteVideoContainerId, facingMode]);

  const setMuted = useCallback((muted: boolean) => {
    audioTrackRef.current?.setMuted(muted);
  }, []);

  const setCameraOn = useCallback(async (on: boolean, newFacingMode?: "user" | "environment") => {
    if (!videoTrackRef.current) return;
    if (newFacingMode && clientRef.current) {
      // Switch camera
      videoTrackRef.current.stop();
      videoTrackRef.current.close();
      const newTrack = await AgoraRTC.createCameraVideoTrack({ facingMode: newFacingMode }).catch(() => null);
      if (newTrack) {
        videoTrackRef.current = newTrack;
        await clientRef.current.unpublish([videoTrackRef.current]).catch(() => {});
        await clientRef.current.publish([newTrack]).catch(() => {});
        newTrack.play(localVideoContainerId);
      }
    } else {
      videoTrackRef.current.setMuted(!on);
    }
  }, [localVideoContainerId]);

  return { joined, hasRemote, setMuted, setCameraOn };
}

