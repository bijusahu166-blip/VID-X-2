import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useCreatePost } from "@/hooks/use-posts";
import { 
  ImagePlus, 
  Loader2, 
  Video, 
  Layout, 
  PenTool, 
  Radio, 
  Music, 
  Scissors, 
  Type, 
  Smile, 
  Sparkles,
  Pentagon
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type UploadType = "post" | "reel" | "story" | "live" | "editing";

export function CreatePostDialog({ open, onOpenChange }: CreatePostDialogProps) {
  const [step, setStep] = useState<"select" | "edit" | "details">("select");
  const [uploadType, setUploadType] = useState<UploadType>("post");
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [storyShape, setStoryShape] = useState<"circle" | "pentagon">("circle");
  const [storyColor, setStoryColor] = useState<"default" | "violet" | "teal">("default");
  
  const createPost = useCreatePost();

  const handleTypeSelect = (type: UploadType) => {
    setUploadType(type);
    if (type === "live") {
      // Live might go to a different flow, but for now just details
      setStep("details");
    } else if (type === "editing" || type === "reel" || type === "story") {
      setStep("edit");
    } else {
      setStep("details");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl && uploadType !== "live") return;

    try {
      await createPost.mutateAsync({
        imageUrl: imageUrl || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60", // Placeholder for non-image types
        caption,
        userId: "temp",
        type: uploadType
      });
      handleClose();
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setStep("select");
      setUploadType("post");
      setImageUrl("");
      setCaption("");
      setStoryShape("circle");
      setStoryColor("default");
    }, 300);
  };

  const uploadOptions = [
    { id: "post", label: "Post", icon: Layout, color: "text-blue-500" },
    { id: "reel", label: "Reels", icon: Video, color: "text-purple-500" },
    { id: "story", label: "Story", icon: Layout, color: "text-pink-500" },
    { id: "editing", label: "Editing", icon: PenTool, color: "text-orange-500" },
    { id: "live", label: "Live", icon: Radio, color: "text-red-500" },
  ];

  const editingTools = [
    { icon: Music, label: "Music" },
    { icon: Scissors, label: "Edit" },
    { icon: Type, label: "Text" },
    { icon: Smile, label: "Stickers" },
    { icon: Sparkles, label: "Effects" },
  ];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-none shadow-2xl overflow-hidden p-0">
        <DialogHeader className="p-6 border-b border-border/50">
          <DialogTitle className="text-center font-display text-xl">
            {step === "select" && "Create New"}
            {step === "edit" && `Edit ${uploadType.charAt(0).toUpperCase() + uploadType.slice(1)}`}
            {step === "details" && "Final Details"}
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-6">
          {step === "select" && (
            <div className="grid grid-cols-2 gap-4">
              {uploadOptions.map((opt) => (
                <Button
                  key={opt.id}
                  variant="outline"
                  className="h-24 flex flex-col gap-2 rounded-2xl hover:bg-muted/50 border-border/50"
                  onClick={() => handleTypeSelect(opt.id as UploadType)}
                >
                  <opt.icon className={cn("w-8 h-8", opt.color)} />
                  <span className="font-semibold">{opt.label}</span>
                </Button>
              ))}
            </div>
          )}

          {step === "edit" && (
            <div className="space-y-6">
              <div className="aspect-[9/16] rounded-2xl bg-muted relative overflow-hidden flex items-center justify-center border-2 border-dashed border-border">
                {imageUrl ? (
                  <>
                    <img 
                      src={imageUrl} 
                      alt="Preview" 
                      className={cn(
                        "w-full h-full object-cover",
                        uploadType === "story" && storyShape === "pentagon" && "clip-pentagon"
                      )} 
                    />
                    {uploadType === "story" && storyColor !== "default" && (
                      <div className={cn(
                        "absolute inset-0 opacity-20",
                        storyColor === "violet" && "bg-violet-500",
                        storyColor === "teal" && "bg-teal-500"
                      )} />
                    )}
                  </>
                ) : (
                  <div className="text-center space-y-2">
                    <ImagePlus className="w-12 h-12 text-muted-foreground mx-auto" />
                    <p className="text-sm text-muted-foreground">Select media to start editing</p>
                    <Input
                      type="file"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={(e) => {
                        // For demo, just set a random image if they try to upload
                        setImageUrl("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800");
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Editing Tools */}
              <div className="flex justify-between items-center px-2">
                {editingTools.map((tool) => (
                  <button
                    key={tool.label}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div className="p-3 rounded-full bg-secondary group-hover:bg-primary/10 transition-colors">
                      <tool.icon className="w-5 h-5 text-foreground" />
                    </div>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{tool.label}</span>
                  </button>
                ))}
              </div>

              {/* Story Specific Customization */}
              {uploadType === "story" && (
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Shape Style</span>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant={storyShape === "circle" ? "default" : "outline"}
                        onClick={() => setStoryShape("circle")}
                        className="rounded-full w-8 h-8 p-0"
                      >
                        C
                      </Button>
                      <Button 
                        size="sm" 
                        variant={storyShape === "pentagon" ? "default" : "outline"}
                        onClick={() => setStoryShape("pentagon")}
                        className="rounded-full w-8 h-8 p-0"
                      >
                        <Pentagon className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Accent Color</span>
                    <div className="flex gap-2">
                      <button 
                        className={cn("w-6 h-6 rounded-full border-2", storyColor === "default" ? "border-primary" : "border-transparent")}
                        onClick={() => setStoryColor("default")}
                        style={{ background: "linear-gradient(to right, #833ab4, #fd1d1d, #fcb045)" }}
                      />
                      <button 
                        className={cn("w-6 h-6 rounded-full bg-violet-500 border-2", storyColor === "violet" ? "border-primary" : "border-transparent")}
                        onClick={() => setStoryColor("violet")}
                      />
                      <button 
                        className={cn("w-6 h-6 rounded-full bg-teal-500 border-2", storyColor === "teal" ? "border-primary" : "border-transparent")}
                        onClick={() => setStoryColor("teal")}
                      />
                    </div>
                  </div>
                </div>
              )}

              <Button 
                className="w-full h-12 rounded-xl font-bold text-lg"
                onClick={() => setStep("details")}
                disabled={!imageUrl}
              >
                Next
              </Button>
            </div>
          )}

          {step === "details" && (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="flex gap-4">
                <div className="w-20 h-20 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                  {imageUrl && <img src={imageUrl} alt="Thumbnail" className="w-full h-full object-cover" />}
                </div>
                <Textarea
                  placeholder="Write a caption..."
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="flex-1 resize-none border-none bg-muted/50 focus:ring-0 min-h-[80px]"
                />
              </div>

              <div className="space-y-4">
                <Button 
                  type="submit" 
                  className="w-full bg-gradient-social hover:opacity-90 transition-opacity h-12 rounded-xl font-bold text-lg"
                  disabled={createPost.isPending}
                >
                  {createPost.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    uploadType === "live" ? "Go Live" : "Share"
                  )}
                </Button>
                <Button 
                  type="button" 
                  variant="ghost" 
                  className="w-full"
                  onClick={() => setStep(uploadType === "post" || uploadType === "live" ? "select" : "edit")}
                >
                  Back
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

