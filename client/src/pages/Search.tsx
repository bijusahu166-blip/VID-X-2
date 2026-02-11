import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon } from "lucide-react";
import { motion } from "framer-motion";
import { usePosts } from "@/hooks/use-posts";

export default function Search() {
  const { data: posts } = usePosts();

  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <div className="grid grid-cols-3 gap-0.5 md:gap-4 p-0.5 md:p-4">
        {posts?.map((post, i) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className={`relative aspect-square bg-muted overflow-hidden ${i % 7 === 0 ? 'col-span-2 row-span-2' : ''}`}
          >
            <img 
              src={post.imageUrl} 
              alt="Explore" 
              className="w-full h-full object-cover hover:scale-110 transition-transform duration-500"
            />
          </motion.div>
        )) || (
          // Skeletons
          Array(12).fill(0).map((_, i) => (
             <div key={i} className="aspect-square bg-muted animate-pulse" />
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}
