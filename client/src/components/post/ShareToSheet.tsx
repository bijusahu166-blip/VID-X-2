import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Check, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: following, isLoading } = useQuery<any[]>({
    queryKey: ["/api/users/following"],
    queryFn: () => fetch("/api/users/following", { credentials: "include" }).then(r => r.json()),
    enabled: open,
  });

  const sendMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/posts/${postId}/send`, {
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
      onOpenChange(false);
    },
    onError: () => toast({ title: "Couldn't send", variant: "destructive" }),
  });

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] bg-zinc-950 border-t border-zinc-800 rounded-t-3xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="text-white">Send to</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-cyan-500 animate-spin" /></div>
          ) : !following || following.length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-10">You're not following anyone yet.</p>
          ) : (
            following.map((u: any) => (
              <button
                key={u.id}
                onClick={() => toggle(u.id)}
                className="w-full flex items-center justify-between px-2 py-3 hover:bg-white/5 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 shrink-0">
                    {u.profileImageUrl ? (
                      <img src={u.profileImageUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white text-sm font-bold">
                        {u.firstName?.[0]}
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-white font-medium">@{u.username || u.firstName}</span>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selected.has(u.id) ? "bg-cyan-500 border-cyan-500" : "border-zinc-600"}`}>
                  {selected.has(u.id) && <Check className="w-3 h-3 text-white" />}
                </div>
              </button>
            ))
          )}
        </div>
        <button
          onClick={() => sendMutation.mutate()}
          disabled={selected.size === 0 || sendMutation.isPending}
          className="w-full h-11 rounded-full bg-cyan-500 flex items-center justify-center gap-2 text-white font-bold disabled:opacity-40"
        >
          {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send {selected.size > 0 && `(${selected.size})`}
        </button>
      </SheetContent>
    </Sheet>
  );
}