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
  const clientRef = useRef<ReturnType<typeof AgoraRTM.createInstance> | null>(null);
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled || !channelName || !uid) return;

    let destroyed = false;

    const init = async () => {
      const appId = await getAgoraAppId();
      if (!appId || destroyed) return;

      const rtm = AgoraRTM.createInstance(appId, { logFilter: AgoraRTM.LOG_FILTER_OFF });
      clientRef.current = rtm;

      // RTM UID must be alphanumeric — strip hyphens from UUID-style IDs
      const safeUid = String(uid).replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 64);

      await rtm.login({ uid: safeUid, token: undefined });

      const channel = rtm.createChannel(channelName);
      channelRef.current = channel;

      channel.on("ChannelMessage", (msg: { text?: string }, _memberId: string) => {
        if (destroyed || !msg.text) return;
        try {
          const data = JSON.parse(msg.text) as RTMMessage;
          if (data.user && data.msg) {
            setMessages(prev => [...prev.slice(-49), data]);
          }
        } catch { /* ignore malformed */ }
      });

      await channel.join();
      if (!destroyed) setConnected(true);
    };

    init().catch(() => {});

    return () => {
      destroyed = true;
      channelRef.current?.leave().catch(() => {});
      clientRef.current?.logout().catch(() => {});
      channelRef.current = null;
      clientRef.current = null;
      setConnected(false);
    };
  }, [channelName, uid, enabled]);

  const sendMessage = useCallback(async (text: string) => {
    if (!channelRef.current || !text.trim()) return;
    const msg: RTMMessage = { user: displayName, msg: text.trim(), color };
    try {
      await channelRef.current.sendMessage({ text: JSON.stringify(msg) });
      setMessages(prev => [...prev.slice(-49), msg]);
    } catch { /* send silently failed */ }
  }, [displayName, color]);

  return { messages, sendMessage, connected };
}
