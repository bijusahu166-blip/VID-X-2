import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2, X, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

type Story = {
  id: number | string;
  userId?: string | number;
  mediaUrl?: string | null;
  type?: string | null;
  caption?: string | null;
  createdAt?: string | Date | null;
  expiresAt?: string | Date | null;
  user?: {
    id?: string | number;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    profileImageUrl?: string | null;
  };
};

interface StoryViewerProps {
  stories: Story[];
  initialIndex?: number;
  onClose: () => void;
}

export function StoryViewer({ stories, initialIndex = 0, onClose }: StoryViewerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Story[]>(stories ?? []);
  const [index, setIndex] = useState(Math.max(0, Math.min(initialIndex, Math.max(0, (stories?.length ?? 1) - 1))));
  const [muted, setMuted] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setItems(stories ?? []);
    setIndex(Math.max(0, Math.min(initialIndex, Math.max(0, (stories?.length ?? 1) - 1))));
  }, [stories, initialIndex]);

  const story = items[index];
  const isOwnStory = !!story && String(story.userId ?? story.user?.id) === String(user?.id);

  const authorName = useMemo(() => {
    if (!story?.user) return "User";
    return story.user.firstName || story.user.username || "User";
  }, [story]);

  useEffect(() => {
    if (!story) {
      onClose();
      return;
    }

    const timer = window.setTimeout(() => {
      if (index < items.length - 1) setIndex((i) => i + 1);
      else onClose();
    }, 10000);

    return () => window.clearTimeout(timer);
  }, [story?.id, index, items.length, onClose, story]);

  const goPrev = () => setIndex((i) => Math.max(0, i - 1));
  const goNext = () => {
    if (index < items.length - 1) setIndex((i) => i + 1);
    else onClose();
  };

  const deleteStory = async () => {
    if (!story || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/stories/${story.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Failed to delete story");

      const nextItems = items.filter((item) => String(item.id) !== String(story.id));
      setItems(nextItems);

      toast({ title: "Story deleted", description: "Your story was removed." });

      if (nextItems.length === 0) {
        onClose();
      } else if (index >= nextItems.length) {
        setIndex(nextItems.length - 1);
      }
    } catch (err: any) {
      toast({
        title: "Could not delete story",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (!story) return null;

  const isVideo = story.type === "video" || /\.(mp4|webm|mov|mkv|3gp)(\?|$)/i.test(story.mediaUrl || "");
  const media = story.mediaUrl || "";

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black flex items-center justify-center overflow-hidden"
      onTouchStart={(e) => { touchStartX.current = e.touches[0]?.clientX ?? null; }}
      onTouchEnd={(e) => {
        if (touchStartX.current == null) return;
        const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
        const dx = endX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(dx) > 50) dx > 0 ? goPrev() : goNext();
      }}
    >
      {/* Blurred backdrop is decorative only. The actual media stays sharp and uncropped. */}
      {media && (
        <>
          {isVideo ? (
            <video src={media} className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-30" muted playsInline />
          ) : (
            <img src={media} alt="" className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-30" />
          )}
          <div className="absolute inset-0 bg-black/35" />
        </>
      )}

      <div className="absolute top-0 left-0 right-0 z-20 px-3 pt-[max(env(safe-area-inset-top),12px)]">
        <div className="flex gap-1">
          {items.map((item, i) => (
            <div key={item.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
              <div className={`h-full rounded-full bg-white transition-all duration-200 ${i < index ? "w-full" : i === index ? "w-full" : "w-0"}`} />
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border border-white/50 bg-zinc-800 shrink-0">
            {story.user?.profileImageUrl ? (
              <img src={story.user.profileImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white font-bold">{authorName[0]?.toUpperCase() || "U"}</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-bold truncate">{authorName}</p>
            <p className="text-white/60 text-[10px]">{story.createdAt ? new Date(story.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : ""}</p>
          </div>

          {isOwnStory && (
            <button
              type="button"
              onClick={deleteStory}
              disabled={deleting}
              className="w-10 h-10 rounded-full bg-red-500/90 flex items-center justify-center text-white disabled:opacity-50"
              aria-label="Delete story"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          {isVideo && (
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              className="w-10 h-10 rounded-full bg-black/55 border border-white/10 flex items-center justify-center text-white"
              aria-label={muted ? "Unmute story" : "Mute story"}
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
          )}
          <button type="button" onClick={onClose} className="w-10 h-10 rounded-full bg-black/55 border border-white/10 flex items-center justify-center text-white" aria-label="Close story">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <button type="button" onClick={goPrev} disabled={index === 0} className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/35 text-white flex items-center justify-center disabled:opacity-20" aria-label="Previous story">
        <ChevronLeft className="w-6 h-6" />
      </button>

      <div className="relative z-10 w-full h-full flex items-center justify-center px-3 py-24">
        {media ? (
          isVideo ? (
            <video
              key={story.id}
              src={media}
              className="max-w-full max-h-full w-auto h-auto object-contain"
              controls
              autoPlay
              playsInline
              loop={false}
              muted={muted}
            />
          ) : (
            <img
              key={story.id}
              src={media}
              alt="Story"
              className="max-w-full max-h-full w-auto h-auto object-contain"
            />
          )
        ) : (
          <div className="max-w-md px-8 text-center text-white text-xl font-bold">{story.caption || "✨"}</div>
        )}
      </div>

      {story.caption && (
        <div className="absolute bottom-8 left-0 right-0 z-20 px-8 text-center pointer-events-none">
          <p className="inline-block max-w-[90%] rounded-xl bg-black/45 px-4 py-2 text-sm text-white">{story.caption}</p>
        </div>
      )}

      <button type="button" onClick={goNext} className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/35 text-white flex items-center justify-center" aria-label="Next story">
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  );
}

export default StoryViewer;
