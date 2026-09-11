import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Loader2, Check, Send, Search, Share } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Share as CapacitorShare } from "@capacitor/share";
import { apiUrl } from "@/lib/queryClient";

export function ShareToSheet({
  open,
  onOpenChange,
  postId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  postId: number;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const { data: following, isLoading } = useQuery<any[]>({
    queryKey: ["/api/users/following"],
    queryFn: () => fetch(apiUrl("/api/users/following"), { credentials: "include" }).then(r => r.json()),
    enabled: open,
  });

  const filteredFollowing = useMemo(() => {
    if (!following) return [];
    const q = search.trim().toLowerCase();
    if (!q) return following;
    return following.filter((u: any) =>
      (u.username || "").toLowerCase().includes(q) ||
      (u.firstName || "").toLowerCase().includes(q) ||
      (u.lastName || "").toLowerCase().includes(q)
    );
  }, [following, search]);

  const sendMutation = useMutation({
    mutationFn: () =>
      fetch(apiUrl(`/api/posts/${postId}/send`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userIds: Array.from(selected) }),
      }).then(r => {
        if (!r.ok) throw new Error("Send failed");
        return r.json();
      }),
    onSuccess: () => {
      toast({ title: `Sent to ${selected.size} people` });
      setSelected(new Set());
      setSearch("");
      onOpenChange(false);
    },
    onError: () => toast({ title: "Couldn't send", variant: "destructive" }),
  });

  const followMutation = useMutation({
    mutationFn: (userId: string) =>
      fetch(apiUrl(`/api/users/${userId}/follow`), { method: "POST", credentials: "include" }).then(r => {
        if (!r.ok) throw new Error("Follow failed");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/users/following"] });
    },
    onError: () => toast({ title: "Couldn't follow", variant: "destructive" }),
  });

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleNativeShare = async () => {
    const shareUrl = `${window.location.origin}/post/${postId}`;
    try {
      await CapacitorShare.share({
        title: "Check this on IQpartner",
        text: "Watch this!",
        url: shareUrl,
      });
    } catch {
      try {
        await navigator.share?.({ title: "IQpartner", url: shareUrl });
      } catch {
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast({ title: "Link copied!" });
        } catch {
          toast({ title: "Couldn't share", variant: "destructive" });
        }
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[75vh] bg-zinc-950 border-t border-zinc-800 rounded-t-3xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-white">Send to</SheetTitle>
        </SheetHeader>

        {/* Search bar */}
        <div className="relative px-1 pt-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search followers…"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-full pl-10 pr-4 py-2.5 text-sm text-white outline-none focus:border-red-500/60"
          />
        </div>

        {/* Native share row (WhatsApp, etc.) */}
        <button
          onClick={handleNativeShare}
          className="flex items-center gap-3 px-2 py-3 mt-2 rounded-xl hover:bg-white/5 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
            <Share className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm text-white font-medium">Share via other apps (WhatsApp, etc.)</span>
        </button>

        <div className="flex-1 overflow-y-auto py-2 border-t border-zinc-800 mt-1">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-red-500 animate-spin" /></div>
          ) : !filteredFollowing || filteredFollowing.length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-10">
              {search ? "No matches found." : "You're not following anyone yet."}
            </p>
          ) : (
            filteredFollowing.map((u: any) => (
              <div
                key={u.id}
                className="w-full flex items-center justify-between px-2 py-3 hover:bg-white/5 rounded-xl"
              >
                <button onClick={() => toggle(u.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                    {u.profileImageUrl ? (
                      <img src={u.profileImageUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold">
                        {u.firstName?.[0]}
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-white font-medium truncate">@{u.username || u.firstName}</span>
                </button>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => followMutation.mutate(u.id)}
                    disabled={followMutation.isPending}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-full border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    Following ✓
                  </button>
                  <button
                    onClick={() => toggle(u.id)}
                    className={`w-5 h-5 rounded-full border flex items-center justify-center ${selected.has(u.id) ? "bg-red-500 border-red-500" : "border-zinc-600"}`}
                  >
                    {selected.has(u.id) && <Check className="w-3 h-3 text-white" />}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <button
          onClick={() => sendMutation.mutate()}
          disabled={selected.size === 0 || sendMutation.isPending}
          className="w-full h-11 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center gap-2 text-white font-bold disabled:opacity-40 transition-colors"
        >
          {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send {selected.size > 0 && `(${selected.size})`}
        </button>
      </SheetContent>
    </Sheet>
  );
}