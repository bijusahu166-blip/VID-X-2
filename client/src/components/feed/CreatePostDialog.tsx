import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useCreatePost } from "@/hooks/use-posts";
import {
  ImagePlus, Loader2, Video, Radio,
  Music, Scissors, Type, Smile, Sparkles,
  Upload, Film, Globe, Lock, Users, ChevronRight,
  Tag, AlignLeft, Captions, ListVideo, X
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type UploadType = "post" | "video" | "reel" | "story" | "live" | "editing";

const CATEGORIES = ["Vlog", "Gaming", "Music", "Travel", "Food", "Tech", "Education", "Comedy", "Fitness", "Fashion"];
const VISIBILITY = [
  { id: "public", label: "Public", icon: Globe, desc: "Everyone can see" },
  { id: "private", label: "Private", icon: Lock, desc: "Only you" },
  { id: "followers", label: "Followers", icon: Users, desc: "Your followers only" },
];

const UPLOAD_OPTIONS = [
  {
    id: "video",
    label: "Video",
    icon: Film,
    desc: "Upload a vlog or long video",
    gradient: "from-red-500 to-orange-500",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.4)",
    glow: "rgba(239,68,68,0.2)",
    featured: true,
  },
  {
    id: "post",
    label: "Photo Post",
    icon: ImagePlus,
    desc: "Share a photo",
    gradient: "from-purple-500 to-pink-500",
    bg: "rgba(168,85,247,0.1)",
    border: "rgba(168,85,247,0.35)",
    glow: "rgba(168,85,247,0.15)",
    featured: false,
  },
  {
    id: "reel",
    label: "Reel",
    icon: Video,
    desc: "Short vertical clip",
    gradient: "from-pink-500 to-rose-500",
    bg: "rgba(236,72,153,0.1)",
    border: "rgba(236,72,153,0.35)",
    glow: "rgba(236,72,153,0.15)",
    featured: false,
  },
  {
    id: "story",
    label: "Story",
    icon: Sparkles,
    desc: "Disappears in 24h",
    gradient: "from-yellow-400 to-orange-500",
    bg: "rgba(234,179,8,0.1)",
    border: "rgba(234,179,8,0.35)",
    glow: "rgba(234,179,8,0.15)",
    featured: false,
  },
  {
    id: "live",
    label: "Go Live",
    icon: Radio,
    desc: "Stream in real-time",
    gradient: "from-red-600 to-pink-600",
    bg: "rgba(220,38,38,0.1)",
    border: "rgba(220,38,38,0.4)",
    glow: "rgba(220,38,38,0.2)",
    featured: false,
  },
];

const EDITING_TOOLS = [
  { icon: Music, label: "Music" },
  { icon: Scissors, label: "Trim" },
  { icon: Type, label: "Text" },
  { icon: Smile, label: "Stickers" },
  { icon: Sparkles, label: "Effects" },
];

export function CreatePostDialog({ open, onOpenChange }: CreatePostDialogProps) {
  const [step, setStep] = useState<"select" | "edit" | "video-details" | "details">("select");
  const [uploadType, setUploadType] = useState<UploadType>("post");
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  // Video-specific state
  const [videoTitle, setVideoTitle] = useState("");
  const [videoDesc, setVideoDesc] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Vlog");
  const [visibility, setVisibility] = useState("public");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [storyDuration, setStoryDuration] = useState<"6h" | "12h" | "24h">("24h");

  const createPost = useCreatePost();

  const handleTypeSelect = (type: UploadType) => {
    setUploadType(type);
    if (type === "video") setStep("video-details");
    else if (type === "live") setStep("details");
    else if (type === "editing" || type === "reel" || type === "story") setStep("edit");
    else setStep("details");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCaption = uploadType === "video"
      ? `${videoTitle}${videoDesc ? `\n${videoDesc}` : ""}`
      : caption;
    try {
      await createPost.mutateAsync({
        imageUrl: thumbnailUrl || imageUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60",
        caption: finalCaption,
        userId: "temp",
        type: uploadType === "video" ? "post" : uploadType,
      });
      handleClose();
    } catch {}
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep("select");
      setUploadType("post");
      setImageUrl("");
      setCaption("");
      setVideoTitle("");
      setVideoDesc("");
      setSelectedCategory("Vlog");
      setVisibility("public");
      setThumbnailUrl("");
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-black border border-white/10 shadow-2xl overflow-hidden p-0 rounded-2xl">
        <DialogDescription className="sr-only">Create new content</DialogDescription>

        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-white/8 flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            {step !== "select" && (
              <button onClick={() => setStep(step === "video-details" || step === "details" ? "select" : "select")}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors mr-1">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <DialogTitle className="text-base font-bold text-white">
              {step === "select" && "Create"}
              {step === "video-details" && "Upload Video"}
              {step === "edit" && `Edit ${uploadType.charAt(0).toUpperCase() + uploadType.slice(1)}`}
              {step === "details" && "Final Details"}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="p-4 max-h-[80vh] overflow-y-auto">

          {/* ── STEP: SELECT TYPE ── */}
          {step === "select" && (
            <div className="space-y-2.5">
              {/* Featured: Video */}
              {UPLOAD_OPTIONS.filter(o => o.featured).map((opt) => (
                <button key={opt.id} onClick={() => handleTypeSelect(opt.id as UploadType)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.99] text-left"
                  style={{ background: opt.bg, borderColor: opt.border, boxShadow: `0 0 20px ${opt.glow}` }}>
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${opt.gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                    <opt.icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{opt.label}</span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-wide">Creator</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5">{opt.desc} — ideal for vlogs, tutorials & more</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                </button>
              ))}

              {/* Other options grid */}
              <div className="grid grid-cols-2 gap-2.5 mt-1">
                {UPLOAD_OPTIONS.filter(o => !o.featured).map((opt) => (
                  <button key={opt.id} onClick={() => handleTypeSelect(opt.id as UploadType)}
                    className="flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98] text-center"
                    style={{ background: opt.bg, borderColor: opt.border, boxShadow: `0 0 15px ${opt.glow}` }}>
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${opt.gradient} flex items-center justify-center shadow-lg`}>
                      <opt.icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm">{opt.label}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">{opt.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP: VIDEO UPLOAD DETAILS ── */}
          {step === "video-details" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Upload area */}
              <div className="relative w-full h-36 rounded-2xl border-2 border-dashed border-white/15 bg-white/3 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-red-500/40 hover:bg-red-500/5 transition-all group">
                <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload className="w-5 h-5 text-red-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white">Drop video file here</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">MP4, MOV, AVI up to 4GB</p>
                </div>
                <input type="file" accept="video/*" className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <AlignLeft className="w-3 h-3" /> Title *
                </Label>
                <Input
                  placeholder="Add a catchy title for your video..."
                  value={videoTitle}
                  onChange={(e) => setVideoTitle(e.target.value)}
                  className="bg-white/5 border-white/10 focus:border-red-500/50 rounded-xl text-white placeholder:text-zinc-600"
                  maxLength={100}
                />
                <p className="text-[10px] text-zinc-600 text-right">{videoTitle.length}/100</p>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Captions className="w-3 h-3" /> Description
                </Label>
                <Textarea
                  placeholder="Tell viewers about your video — add hashtags, links, chapters..."
                  value={videoDesc}
                  onChange={(e) => setVideoDesc(e.target.value)}
                  className="bg-white/5 border-white/10 focus:border-red-500/50 rounded-xl text-white placeholder:text-zinc-600 resize-none min-h-[90px]"
                  maxLength={500}
                />
              </div>

              {/* Thumbnail */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ImagePlus className="w-3 h-3" /> Thumbnail URL
                </Label>
                <Input
                  placeholder="https://... (leave blank for auto-thumbnail)"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  className="bg-white/5 border-white/10 focus:border-red-500/50 rounded-xl text-white placeholder:text-zinc-600 text-[12px]"
                />
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Tag className="w-3 h-3" /> Category
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button key={cat} type="button" onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                        selectedCategory === cat
                          ? "bg-red-500/20 border-red-500/60 text-red-300"
                          : "bg-white/5 border-white/10 text-zinc-500 hover:border-white/25 hover:text-white"
                      }`}>
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Visibility */}
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <ListVideo className="w-3 h-3" /> Visibility
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {VISIBILITY.map((v) => {
                    const Icon = v.icon;
                    return (
                      <button key={v.id} type="button" onClick={() => setVisibility(v.id)}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all ${
                          visibility === v.id
                            ? "bg-red-500/15 border-red-500/50 text-red-300"
                            : "bg-white/3 border-white/8 text-zinc-500 hover:border-white/20"
                        }`}>
                        <Icon className="w-4 h-4" />
                        <span className="text-[10px] font-bold">{v.label}</span>
                        <span className="text-[8px] text-zinc-600">{v.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={!videoTitle || createPost.isPending}
                className="w-full h-12 rounded-xl font-black text-sm uppercase tracking-widest transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{
                  background: videoTitle ? "linear-gradient(135deg, #ef4444, #f97316)" : "rgba(255,255,255,0.05)",
                  boxShadow: videoTitle ? "0 0 20px rgba(239,68,68,0.4)" : "none",
                  color: "white",
                }}>
                {createPost.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Upload className="w-4 h-4" /> Publish Video</>}
              </button>
            </form>
          )}

          {/* ── STEP: EDIT (Reel / Story) ── */}
          {step === "edit" && (
            <div className="space-y-5">
              <div className="aspect-[9/16] rounded-2xl bg-white/5 relative overflow-hidden flex items-center justify-center border border-dashed border-white/15">
                {imageUrl ? (
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center space-y-2 relative">
                    <ImagePlus className="w-10 h-10 text-zinc-600 mx-auto" />
                    <p className="text-xs text-zinc-600">Tap to select media</p>
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={() => setImageUrl("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800")} />
                  </div>
                )}
              </div>
              <div className="flex justify-between px-2">
                {EDITING_TOOLS.map((tool) => (
                  <button key={tool.label} className="flex flex-col items-center gap-1 group">
                    <div className="p-3 rounded-full bg-white/8 group-hover:bg-white/15 transition-colors">
                      <tool.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[9px] text-zinc-500 font-bold uppercase">{tool.label}</span>
                  </button>
                ))}
              </div>
              {/* Story-specific: duration picker */}
              {uploadType === "story" && (
                <div className="space-y-2 pt-3 border-t border-white/8">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Story Duration</span>
                  <div className="grid grid-cols-3 gap-2">
                    {(["6h", "12h", "24h"] as const).map((d) => (
                      <button key={d} type="button" onClick={() => setStoryDuration(d)}
                        className={`py-2 rounded-xl text-[11px] font-black border transition-all ${
                          storyDuration === d
                            ? "bg-yellow-500/20 border-yellow-500/60 text-yellow-300"
                            : "bg-white/5 border-white/10 text-zinc-500 hover:border-white/25"
                        }`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button className="w-full h-11 rounded-xl font-bold" onClick={() => setStep("details")} disabled={!imageUrl}>
                Next
              </Button>
            </div>
          )}

          {/* ── STEP: DETAILS (Post / Live) ── */}
          {step === "details" && uploadType !== "video" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex gap-3">
                <div className="w-20 h-20 rounded-xl bg-white/8 overflow-hidden shrink-0 border border-white/10">
                  {imageUrl && <img src={imageUrl} alt="thumb" className="w-full h-full object-cover" />}
                </div>
                <Textarea
                  placeholder={uploadType === "live" ? "What's your stream about?" : "Write a caption..."}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="flex-1 resize-none bg-white/5 border-white/10 rounded-xl placeholder:text-zinc-600 min-h-[80px]"
                />
              </div>
              {uploadType !== "live" && (
                <Input placeholder="Image URL..." value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                  className="bg-white/5 border-white/10 rounded-xl placeholder:text-zinc-600 text-sm" />
              )}
              <Button type="submit" className="w-full h-11 rounded-xl font-bold bg-gradient-to-r from-primary to-accent" disabled={createPost.isPending}>
                {createPost.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : uploadType === "live" ? "🔴 Go Live" : "Share"}
              </Button>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
