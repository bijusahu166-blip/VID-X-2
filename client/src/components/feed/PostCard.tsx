import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Heart, MessageCircle, Send, Bookmark } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useLikePost, useAddComment } from "@/hooks/use-posts";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface PostCardProps {
  post: any; // Type from API
}

export function PostCard({ post }: PostCardProps) {
  const [comment, setComment] = useState("");
  const likeMutation = useLikePost();
  const commentMutation = useAddComment();
  const [showHeart, setShowHeart] = useState(false);

  const handleLike = () => {
    likeMutation.mutate(post.id);
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    commentMutation.mutate({ postId: post.id, content: comment });
    setComment("");
  };

  return (
    <Card className="border-0 shadow-none sm:border sm:shadow-sm rounded-none sm:rounded-3xl mb-4 overflow-hidden bg-card">
      <CardHeader className="flex flex-row items-center space-x-4 p-4">
        <Avatar className="w-10 h-10 ring-2 ring-transparent hover:ring-primary transition-all cursor-pointer">
          <AvatarImage src={post.user?.profileImageUrl || undefined} />
          <AvatarFallback>{post.user?.firstName?.[0] || "U"}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <p className="text-sm font-semibold hover:underline cursor-pointer">
            {post.user?.firstName || "Anonymous"} {post.user?.lastName}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
          </p>
        </div>
      </CardHeader>
      
      <div className="relative aspect-square bg-muted" onDoubleClick={handleLike}>
        {/* Placeholder for actual image loading */}
        <img 
          src={post.imageUrl} 
          alt="Post content" 
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        <AnimatePresence>
          {showHeart && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <Heart className="w-24 h-24 fill-white text-white drop-shadow-2xl" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CardContent className="p-4 pb-2">
        <div className="flex justify-between items-center mb-4">
          <div className="flex space-x-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="hover:text-destructive hover:bg-destructive/10 -ml-2"
              onClick={handleLike}
            >
              <Heart className={cn("w-6 h-6 transition-all", post.hasLiked ? "fill-destructive text-destructive" : "")} />
            </Button>
            <Button variant="ghost" size="icon">
              <MessageCircle className="w-6 h-6" />
            </Button>
            <Button variant="ghost" size="icon">
              <Send className="w-6 h-6" />
            </Button>
          </div>
          <Button variant="ghost" size="icon">
            <Bookmark className="w-6 h-6" />
          </Button>
        </div>

        <div className="space-y-2">
          <p className="font-semibold text-sm">
            {post.likesCount || 0} likes
          </p>
          <p className="text-sm">
            <span className="font-semibold mr-2">{post.user?.firstName}:</span>
            {post.caption}
          </p>
          
          {post.commentsCount > 0 && (
            <button className="text-sm text-muted-foreground hover:text-foreground">
              View all {post.commentsCount} comments
            </button>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <form onSubmit={handleComment} className="w-full flex gap-2 items-center">
          <Input 
            placeholder="Add a comment..." 
            className="border-none shadow-none focus-visible:ring-0 px-0 h-auto py-2"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          {comment && (
            <Button 
              type="submit" 
              variant="ghost" 
              className="text-primary font-semibold hover:text-primary/80 px-2"
              disabled={commentMutation.isPending}
            >
              Post
            </Button>
          )}
        </form>
      </CardFooter>
    </Card>
  );
}
