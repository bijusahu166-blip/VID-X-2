import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useCreatePost } from "@/hooks/use-posts";
import { ImagePlus, Loader2 } from "lucide-react";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePostDialog({ open, onOpenChange }: CreatePostDialogProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const createPost = useCreatePost();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl) return;

    try {
      await createPost.mutateAsync({
        imageUrl,
        caption,
        userId: "temp", // Backend should handle user ID from session
        type: "post"
      });
      onOpenChange(false);
      setImageUrl("");
      setCaption("");
    } catch (error) {
      // Error handled by hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-none shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-center font-display text-xl">Create New Post</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <div className="space-y-2">
            <Label htmlFor="image" className="sr-only">Image URL</Label>
            <div className="relative group">
              {imageUrl ? (
                <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                  <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setImageUrl("")}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="aspect-square rounded-xl border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center bg-muted/50 hover:bg-muted transition-colors">
                  <Input
                    id="image"
                    placeholder="Paste image URL..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer h-full"
                  />
                  <ImagePlus className="w-10 h-10 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground font-medium">Paste Image URL</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="caption" className="sr-only">Caption</Label>
            <Textarea
              id="caption"
              placeholder="Write a caption..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="resize-none border-none bg-muted/50 focus:ring-0 min-h-[100px] text-base"
            />
          </div>

          <Button 
            type="submit" 
            className="w-full bg-gradient-social hover:opacity-90 transition-opacity h-12 rounded-xl font-semibold text-lg"
            disabled={!imageUrl || createPost.isPending}
          >
            {createPost.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Share Post"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
