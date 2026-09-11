import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Heart, UserPlus, MessageCircle, Check, Phone, UserCheck, X, PhoneOff, Video, CheckCircle, Flag } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";
import { useState } from "react";
import { playFollow, playNotification } from "@/lib/sounds";
import { VideoCallScreen } from "@/components/call/VideoCallScreen";
import { apiUrl } from "@/lib/queryClient";

interface Notification {
  id: number;
  user_id: string;
  from_user_id: string | null;
  type: string;
  message: string;
  post_id: number | null;
  read: boolean;
  created_at: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  profile_image_url?: string;
}

function NotifIcon({ type }: { type: string }) {
  const base = "w-5 h-5";
  if (type === "like") return (
    <div className="w-6 h-6 rounded-full bg-red-500/90 flex items-center justify-center shadow">
      <Heart className={`${base} w-3 h-3 text-white fill-white`} />
    </div>
  );
  if (type === "follow") return (
    <div className="w-6 h-6 rounded-full bg-violet-500/90 flex items-center justify-center shadow">
      <UserPlus className="w-3 h-3 text-white" />
    </div>
  );
  if (type === "new_user") return (
    <div className="w-6 h-6 rounded-full bg-emerald-500/90 flex items-center justify-center shadow animate-pulse">
      <UserPlus className="w-3 h-3 text-white" />
    </div>
  );
  if (type === "comment") return (
    <div className="w-6 h-6 rounded-full bg-purple-500/90 flex items-center justify-center shadow">
      <MessageCircle className="w-3 h-3 text-white" />
    </div>
  );
  if (type === "message") return (
    <div className="w-6 h-6 rounded-full bg-blue-500/90 flex items-center justify-center shadow">
      <MessageCircle className="w-3 h-3 text-white fill-white" />
    </div>
  );
  if (type === "call") return (
    <div className="w-6 h-6 rounded-full bg-green-500/90 flex items-center justify-center shadow">
      <Phone className="w-3 h-3 text-white" />
    </div>
  );
  if (type === "report_submitted") return (
    <div className="w-6 h-6 rounded-full bg-cyan-500/90 flex items-center justify-center shadow">
      <CheckCircle className="w-3 h-3 text-white" />
    </div>
  );
  return (
    <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center">
      <Bell className="w-3 h-3 text-zinc-300" />
    </div>
  );
}

export default function Notifications() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [followedBack, setFollowedBack] = useState<Set<string>>(new Set());
  const [activeCall, setActiveCall] = useState<{ callerName: string; callerAvatar?: string; audioOnly: boolean } | null>(null);
  const [declinedCallIds, setDeclinedCallIds] = useState<Set<number>>(new Set());

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 15000,
  });

  const readAll = useMutation({
    mutationFn: () => fetch(apiUrl("/api/notifications/read-all"), { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const followBack = async (userId: string) => {
    try {
      await fetch(apiUrl(`/api/users/${userId}/follow`), { method: "POST", credentials: "include" });
      setFollowedBack(prev => new Set(Array.from(prev).concat(userId)));
      playFollow();
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    } catch { /* ignore network errors */ }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const groupedByDay = notifications.reduce((acc, n) => {
    const day = new Date(n.created_at).toDateString();
    if (!acc[day]) acc[day] = [];
    acc[day].push(n);
    return acc;
  }, {} as Record<string, Notification[]>);

  const days = Object.keys(groupedByDay);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-black/95 border-b border-white/8 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3.5">
          <h1 className="text-xl font-black text-white">Notifications</h1>
          {unreadCount > 0 && (
            <button
              onClick={() => readAll.mutate()}
              data-testid="button-read-all-notifications"
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10"
            >
              <Check className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 pb-28">
        {isLoading && (
          <div className="flex flex-col gap-3 p-4">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-zinc-800" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 bg-zinc-800 rounded w-3/4" />
                  <div className="h-3 bg-zinc-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 px-8 gap-4">
            <div className="w-20 h-20 rounded-2xl bg-zinc-900 flex items-center justify-center">
              <Bell className="w-10 h-10 text-zinc-700" />
            </div>
            <div className="text-center">
              <p className="text-white font-bold text-lg mb-2">No notifications yet</p>
              <p className="text-zinc-500 text-sm">When people follow you, like your posts, or send you messages, you'll see it here.</p>
            </div>
          </div>
        )}

        {!isLoading && notifications.length > 0 && (
          <div>
            {days.map(day => (
              <div key={day}>
                <div className="px-4 py-2 sticky top-[57px] bg-black/80 backdrop-blur z-10">
                  <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                    {new Date(day).toDateString() === new Date().toDateString() ? "Today" :
                      new Date(day).toDateString() === new Date(Date.now() - 86400000).toDateString() ? "Yesterday" :
                      new Date(day).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                  </span>
                </div>
                <div className="divide-y divide-white/5">
                  {groupedByDay[day].map(notif => (
                    <div
                      key={notif.id}
                      className={`flex items-start gap-3 px-4 py-3.5 transition-colors cursor-pointer active:bg-white/5
                        ${!notif.read ? "bg-violet-500/5 border-l-2 border-violet-500/50" : ""}`}
                      data-testid={`notification-${notif.id}`}
                      onClick={() => {
                        if (notif.from_user_id) navigate(`/profile/${notif.from_user_id}`);
                      }}
                    >
                      {/* Avatar */}
                      <div className="relative flex-shrink-0">
                        {notif.profile_image_url ? (
                          <img src={notif.profile_image_url} alt="user" className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-bold text-base">
                            {notif.first_name?.[0]?.toUpperCase() ?? "?"}
                          </div>
                        )}
                        <div className="absolute -bottom-1 -right-1">
                          <NotifIcon type={notif.type} />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white leading-snug">
                          {notif.username ? (
                            <><span className="font-bold">@{notif.username}</span> {notif.message.replace(/^\S+\s/, "")}</>
                          ) : notif.message}
                        </p>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                        </p>

                        {/* Follow back button */}
                        {notif.type === "follow" && notif.from_user_id && (
                          <div className="mt-2 flex gap-2" onClick={e => e.stopPropagation()}>
                            {followedBack.has(notif.from_user_id) ? (
                              <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                                <UserCheck className="w-3.5 h-3.5" /> Following
                              </span>
                            ) : (
                              <button
                                onClick={() => followBack(notif.from_user_id!)}
                                className="flex items-center gap-1.5 text-[12px] font-bold bg-violet-600 hover:bg-violet-500 text-white px-3 py-1 rounded-full transition-colors"
                                data-testid={`button-follow-back-${notif.from_user_id}`}
                              >
                                <UserPlus className="w-3 h-3" /> Follow back
                              </button>
                            )}
                          </div>
                        )}

                        {/* Message — go to chat */}
                        {notif.type === "message" && notif.from_user_id && (
                          <div className="mt-2" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => navigate("/messages")}
                              className="text-[12px] font-bold bg-blue-600/80 hover:bg-blue-500 text-white px-3 py-1 rounded-full transition-colors"
                              data-testid={`button-reply-message-${notif.id}`}
                            >
                              Reply
                            </button>
                          </div>
                        )}

                        {/* Call — accept / decline */}
                        {notif.type === "call" && !declinedCallIds.has(notif.id) && (
                          <div className="mt-3 flex gap-2" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                const isAudio = notif.message.toLowerCase().includes("voice");
                                setActiveCall({
                                  callerName: notif.first_name ? `${notif.first_name} ${notif.last_name ?? ""}`.trim() : "Unknown",
                                  callerAvatar: notif.profile_image_url ?? undefined,
                                  audioOnly: isAudio,
                                });
                              }}
                              className="flex items-center gap-1.5 text-[12px] font-bold bg-green-500 hover:bg-green-400 text-white px-4 py-1.5 rounded-full transition-colors"
                              data-testid={`button-accept-call-${notif.id}`}
                            >
                              {notif.message.toLowerCase().includes("voice") ? <Phone className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                              Accept
                            </button>
                            <button
                              onClick={() => setDeclinedCallIds(prev => new Set(Array.from(prev).concat(notif.id)))}
                              className="flex items-center gap-1.5 text-[12px] font-bold bg-red-500/80 hover:bg-red-400 text-white px-4 py-1.5 rounded-full transition-colors"
                              data-testid={`button-decline-call-${notif.id}`}
                            >
                              <PhoneOff className="w-3 h-3" /> Decline
                            </button>
                          </div>
                        )}
                        {notif.type === "call" && declinedCallIds.has(notif.id) && (
                          <p className="mt-1.5 text-[11px] text-red-400/80 flex items-center gap-1">
                            <PhoneOff className="w-3 h-3" /> Call declined
                          </p>
                        )}
                      </div>

                      {/* Unread indicator */}
                      {!notif.read && (
                        <div className="w-2 h-2 rounded-full bg-violet-400 flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active call screen */}
      {activeCall && (
        <VideoCallScreen />
      )}
    </div>
  );
}
