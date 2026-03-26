import { BottomNav } from "@/components/layout/BottomNav";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Heart, UserPlus, Radio, MessageCircle, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  if (type === "like") return <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center"><Heart className="w-4 h-4 text-red-400 fill-red-400" /></div>;
  if (type === "follow") return <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center"><UserPlus className="w-4 h-4 text-blue-400" /></div>;
  if (type === "live") return <div className="w-9 h-9 rounded-full bg-red-600/30 flex items-center justify-center"><Radio className="w-4 h-4 text-red-400 animate-pulse" /></div>;
  if (type === "comment") return <div className="w-9 h-9 rounded-full bg-purple-500/20 flex items-center justify-center"><MessageCircle className="w-4 h-4 text-purple-400" /></div>;
  return <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center"><Bell className="w-4 h-4 text-zinc-400" /></div>;
}

export default function Notifications() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
  });

  const readAll = useMutation({
    mutationFn: () => fetch("/api/notifications/read-all", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const unreadCount = notifications.filter(n => !n.read).length;

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

      <div className="flex-1 pb-20">
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
              <p className="text-zinc-500 text-sm">When people follow you, go live, or interact with your posts, you'll see it here.</p>
            </div>
          </div>
        )}

        {!isLoading && notifications.length > 0 && (
          <div className="divide-y divide-white/5">
            {notifications.map(notif => (
              <div
                key={notif.id}
                className={`flex items-center gap-3 px-4 py-3.5 transition-colors ${!notif.read ? "bg-red-500/5 border-l-2 border-red-500/60" : ""}`}
                data-testid={`notification-${notif.id}`}
              >
                {/* Avatar or type icon */}
                <div className="relative flex-shrink-0">
                  {notif.profile_image_url ? (
                    <img src={notif.profile_image_url} alt="user" className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-white font-bold text-base">
                      {notif.first_name?.[0] ?? "?"}
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
                      <><span className="font-bold">@{notif.username}</span> {notif.message.split(' ').slice(1).join(' ')}</>
                    ) : notif.message}
                  </p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                  </p>
                </div>

                {/* Unread dot */}
                {!notif.read && (
                  <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
