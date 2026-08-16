/**
 * Agora RTM v2 hook for live-stream real-time chat.
 *
 * RTM v2 API (agora-rtm-sdk@2.x):
 *   new AgoraRTM.RTM(appId, userId) → client
 *   client.login()                  → authenticate
 *   client.subscribe(channel)       → join a message channel
 *   client.publish(channel, msg)    → send a string message
 *   client.addEventListener("message", cb) → receive messages
 *   client.unsubscribe(channel) / client.logout() → cleanup
 */
import { useEffect, useState, useRef, useCallback } from "react";
import AgoraRTM from "agora-rtm-sdk";
import { getAgoraAppId } from "./agoraConfig";

export interface RTMMessage {
  user: string;
  msg: string;
  color: string;
}

interface UseAgoraRTMOptions {
  channelName: string;
  uid: string;
  displayName: string;
  color?: string;
  enabled: boolean;
}

export function useAgoraRTM({ channelName, uid, displayName, color = "#60a5fa", enabled }: UseAgoraRTMOptions) {
  const [messages, setMessages] = useState<RTMMessage[]>([]);
  const [connected, setConnected] = useState(false);
  // RTM v2: use RTM class from the default export's .RTM property
  const clientRef = useRef<InstanceType<typeof AgoraRTM.RTM> | null>(null);

  useEffect(() => {
    if (!enabled || !channelName || !uid) return;

    let destroyed = false;

    const init = async () => {
      const appId = await getAgoraAppId();
      if (!appId || destroyed) return;

      // RTM v2: RTM constructor takes (appId, userId)
      // userId must be ≤ 64 chars, alphanumeric + limited special chars
      const safeUid = String(uid).replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 64);

      const rtm = new AgoraRTM.RTM(appId, safeUid);
      clientRef.current = rtm;

      // Listen for incoming channel messages (from all publishers on this channel)
      rtm.addEventListener("message", (event: any) => {
        if (destroyed) return;
        if (event.channelName !== channelName) return;
        try {
          const data = JSON.parse(typeof event.message === "string" ? event.message : "") as RTMMessage;
          if (data.user && data.msg) {
            setMessages(prev => [...prev.slice(-49), data]);
          }
        } catch { /* ignore malformed */ }
      });

      await rtm.login();
      if (destroyed) { await rtm.logout().catch(() => {}); return; }

      await rtm.subscribe(channelName);
      if (destroyed) {
        await rtm.unsubscribe(channelName).catch(() => {});
        await rtm.logout().catch(() => {});
        return;
      }

      setConnected(true);
    };

    init().catch(() => {});

    return () => {
      destroyed = true;
      const cl = clientRef.current;
      if (cl) {
        cl.unsubscribe(channelName).catch(() => {});
        cl.logout().catch(() => {});
        clientRef.current = null;
      }
      setConnected(false);
    };
  }, [channelName, uid, enabled]);

  const sendMessage = useCallback(async (text: string) => {
    if (!clientRef.current || !text.trim() || !channelName) return;
    const payload: RTMMessage = { user: displayName, msg: text.trim(), color };
    try {
      await clientRef.current.publish(channelName, JSON.stringify(payload));
      // Show our own message locally (RTM v2 does NOT echo back to the sender)
      setMessages(prev => [...prev.slice(-49), payload]);
    } catch { /* silently ignore publish failures */ }
  }, [channelName, displayName, color]);

  return { messages, sendMessage, connected };
}

