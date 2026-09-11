import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, apiUrl} from "@/lib/queryClient";
import { CheckCircle2, UserPlus, ChevronRight } from "lucide-react";
import { useState } from "react";

interface Props {
  currentUserId?: string;
  onNavigate: (path: string) => void;
}

export function FollowSuggestions({ currentUserId, onNavigate }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

 const { data: users = [] } = useQuery<any[]>({
  queryKey: ["/api/users"],
  queryFn: async () => {
    const res = await fetch(apiUrl("/api/users"), { credentials: "include" });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  },
});

  const { data: following = [] } = useQuery<any[]>({
    queryKey: ["/api/following-ids"],
    queryFn: async () => {
      if (!currentUserId) return [];
      const res = await fetch(apiUrl(`/api/users/${currentUserId}/following`), { credentials: "include" });
      const data = await res.json();
      return Array.isArray(data) ? data.map((u: any) => String(u.id)) : [];
    },
    enabled: !!currentUserId,
  });

  const followMutation = useMutation({
    mutationFn: (userId: string) => apiRequest("POST", `/api/users/${userId}/follow`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/following-ids"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
    },
  });

  const followingSet = new Set(following);

  const suggestions = (Array.isArray(users) ? users : [])
    .filter(u =>
      String(u.id) !== String(currentUserId) &&
      !followingSet.has(String(u.id)) &&
      !dismissed.has(String(u.id))
    )
    .slice(0, 6);

  if (suggestions.length === 0) return null;

  return (
    <div className="mx-3 my-3 rounded-2xl overflow-hidden"
      style={{
        background: "linear-gradient(135deg, rgba(139,0,0,0.15), rgba(80,0,60,0.2), rgba(20,0,40,0.3))",
        border: "1px solid rgba(139,0,0,0.3)",
        boxShadow: "0 0 24px rgba(139,0,0,0.15)",
      }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-1 h-5 rounded-full"
            style={{ background: "linear-gradient(to bottom, #8B0000, #ff2d55)" }} />
          <span className="text-[13px] font-black text-white tracking-wide">🧛 People to Follow</span>
        </div>
        <button
          onClick={() => onNavigate("/search")}
          className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-0.5 font-semibold"
        >
          See all <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Suggestion cards */}
      <div className="flex gap-2.5 overflow-x-auto scrollbar-hide px-4 pb-4">
        {suggestions.map((u) => {
          const isFollowing = followingSet.has(String(u.id));
          const isPending = followMutation.isPending && followMutation.variables === String(u.id);

          return (
            <div
              key={u.id}
              className="shrink-0 flex flex-col items-center gap-2 p-3 rounded-2xl w-[110px]"
              style={{
                background: "rgba(0,0,0,0.4)",
                border: "1px solid rgba(139,0,0,0.25)",
                backdropFilter: "blur(8px)",
              }}
            >
              {/* Avatar */}
              <button
                onClick={() => onNavigate(`/profile/${u.id}`)}
                className="relative"
              >
                <div className="w-14 h-14 rounded-full p-[2px]"
                  style={{ background: "linear-gradient(135deg, #8B0000, #ff2d55, #a855f7)" }}>
                  <div className="w-full h-full rounded-full overflow-hidden border-2 border-black">
                    <img
                      src={u.profileImageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.firstName}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </button>

              {/* Name */}
              <button
                onClick={() => onNavigate(`/profile/${u.id}`)}
                className="text-center"
              >
                <p className="text-[11px] font-bold text-white truncate max-w-[90px]">
                  {u.firstName} {u.lastName}
                </p>
                <p className="text-[9px] text-zinc-500 truncate max-w-[90px]">
                  @{u.username || u.firstName?.toLowerCase()}
                </p>
              </button>

              {/* Follow button */}
              {isFollowing ? (
                <div className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-bold text-green-400"
                  style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}>
                  <CheckCircle2 className="w-3 h-3" /> Following
                </div>
              ) : (
                <button
                  onClick={() => {
                    followMutation.mutate(String(u.id));
                    // Optimistically dismiss after follow
                    setTimeout(() => setDismissed(prev => new Set([...prev, String(u.id)])), 800);
                  }}
                  disabled={isPending}
                  className="w-full flex items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-bold text-white transition-all active:scale-95"
                  style={{
                    background: "linear-gradient(135deg, #8B0000, #ff2d55)",
                    boxShadow: "0 0 10px rgba(139,0,0,0.4)",
                  }}
                >
                  <UserPlus className="w-3 h-3" />
                  {isPending ? "..." : "Follow"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
