import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, BookOpen, Newspaper } from "lucide-react";
import { motion } from "framer-motion";
import { usePosts } from "@/hooks/use-posts";
import { Link } from "wouter";

export default function Search() {
  const { data: posts } = usePosts();

  return (
    <div className="min-h-screen bg-background pb-20 pt-14">
      <Header />
      
      {/* Books & News Section */}
      <div className="px-4 pt-4">
        <Link href="/reading">
          <motion.div 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg">Books & News Reading</h3>
                <p className="text-sm text-muted-foreground">Read and listen with AI</p>
              </div>
            </div>
            <Newspaper className="w-5 h-5 text-muted-foreground" />
          </motion.div>
        </Link>
      </div>

      <div className="px-4 py-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search accounts or posts..." 
            className="pl-10 rounded-xl bg-muted/50 border-none h-11"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-0.5 md:gap-4 p-0.5 md:p-4 pt-0">
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
