import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toCloudinaryVideoUrl } from "@/lib/utils";
import { apiUrl } from "@/lib/queryClient";

export default function PostView() {
  const { id } = useParams<{ id: string }>();
  const { data: post, isLoading } = useQuery<any>({
    queryKey: ["/api/posts", id],
    queryFn: () => fetch(apiUrl(`/api/posts/${id}`), { credentials: "include" }).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }
  if (!post) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Post not found</div>;
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {post.videoUrl ? (
          <video src={toCloudinaryVideoUrl(post.videoUrl)} controls autoPlay className="w-full rounded-2xl" />
        ) : (
          <img src={post.imageUrl} className="w-full rounded-2xl" />
        )}
        {post.caption && <p className="text-white text-sm mt-3">{post.caption}</p>}
      </div>
    </div>
  );
}