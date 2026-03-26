import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Search as SearchIcon, Users, X, CheckCircle2, UserCircle2, BookOpen, Newspaper } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { usePosts } from "@/hooks/use-posts";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface UserResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profileImageUrl?: string;
  isCelebrity?: boolean;
  bio?: string;
}

function UserCard({ user }: { user: UserResult }) {
  const [, navigate] = useLocation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate(`/profile/${user.id}`)}
      className="flex items-center gap-3 px-4 py-3 bg-zinc-900/60 border border-zinc-800 rounded-2xl cursor-pointer hover:bg-zinc-800/60 transition-all active:scale-98"
    >
      <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800 shrink-0 border-2 border-zinc-700">
        {user.profileImageUrl ? (
          <img src={user.profileImageUrl} alt={user.firstName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-500/30 to-purple-500/30">
            <UserCircle2 className="w-7 h-7 text-zinc-500" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-white truncate">
            {user.firstName} {user.lastName}
          </span>
          {user.isCelebrity && (
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 fill-blue-400 shrink-0" />
          )}
        </div>
        <p className="text-[11px] text-zinc-500 truncate">{user.email}</p>
        {user.bio && (
          <p className="text-[11px] text-zinc-400 truncate mt-0.5">{user.bio}</p>
        )}
      </div>
      <div className="shrink-0">
        <div className="text-[10px] font-bold text-red-400 border border-red-500/40 px-2 py-1 rounded-full">
          View
        </div>
      </div>
    </motion.div>
  );
}

export default function Search() {
  const { data: posts } = usePosts();
  const [searchQuery, setSearchQuery] = useState("");

  const { data: userResults, isLoading: usersLoading } = useQuery<UserResult[]>({
    queryKey: ["/api/users/search", searchQuery],
    queryFn: () => fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, { credentials: "include" }).then(r => r.json()),
    enabled: searchQuery.length >= 1,
    staleTime: 1000,
  });

  const filteredPosts = searchQuery.length >= 1
    ? posts?.filter(p =>
        (p.caption || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (`${p.user?.firstName} ${p.user?.lastName}`).toLowerCase().includes(searchQuery.toLowerCase())
      )
    : posts;

  const isSearching = searchQuery.length >= 1;

  return (
    <div className="min-h-screen bg-black pb-20 pt-14">
      <Header />

      {/* Search bar */}
      <div className="px-4 pt-4 pb-3 sticky top-14 z-40 bg-black/95 backdrop-blur border-b border-white/5">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            autoFocus={false}
            placeholder="Search people, posts..."
            data-testid="input-search"
            className="w-full h-11 pl-10 pr-10 rounded-2xl bg-zinc-900 border border-zinc-800 text-white text-sm placeholder:text-zinc-600 outline-none focus:border-zinc-600 transition-colors"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center hover:bg-zinc-600 transition-colors"
            >
              <X className="w-3 h-3 text-zinc-300" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4">
        <AnimatePresence mode="wait">
          {isSearching ? (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4 pt-4">
              {/* People results */}
              {(usersLoading || (userResults && userResults.length > 0)) && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-zinc-500" />
                    <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">People</span>
                    {usersLoading && <div className="w-3 h-3 rounded-full border border-zinc-600 border-t-transparent animate-spin" />}
                  </div>
                  {usersLoading ? (
                    <div className="space-y-2">
                      {[1, 2].map(i => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3 bg-zinc-900/60 border border-zinc-800 rounded-2xl animate-pulse">
                          <div className="w-12 h-12 rounded-full bg-zinc-800" />
                          <div className="flex-1 space-y-1.5">
                            <div className="h-3 bg-zinc-800 rounded w-1/2" />
                            <div className="h-2.5 bg-zinc-800 rounded w-1/3" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : userResults && userResults.length > 0 ? (
                    <div className="space-y-2">
                      {userResults.map(u => <UserCard key={u.id} user={u} />)}
                    </div>
                  ) : null}
                </div>
              )}

              {/* No people found */}
              {!usersLoading && userResults && userResults.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-6">
                  <UserCircle2 className="w-8 h-8 text-zinc-700" />
                  <p className="text-sm text-zinc-600">No users found for "{searchQuery}"</p>
                </div>
              )}

              {/* Post results */}
              {filteredPosts && filteredPosts.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3 mt-2">
                    <SearchIcon className="w-4 h-4 text-zinc-500" />
                    <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">Posts</span>
                    <span className="text-[10px] text-zinc-600">({filteredPosts.length})</span>
                  </div>
                  <div className="grid grid-cols-3 gap-0.5">
                    {filteredPosts.map((post, i) => (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.04 }}
                        className={`relative aspect-square bg-zinc-900 overflow-hidden ${i % 7 === 0 ? "col-span-2 row-span-2" : ""}`}
                      >
                        {post.imageUrl && !post.imageUrl.startsWith("blob:") ? (
                          <img src={post.imageUrl} alt="Post" className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, hsl(${(post.id * 47) % 360}, 40%, 14%), hsl(${(post.id * 47 + 120) % 360}, 50%, 20%))` }}>
                            <span className="text-[9px] text-white/30 text-center px-1 leading-tight">{post.caption?.slice(0, 30)}</span>
                          </div>
                        )}
                        <div className="absolute bottom-1 left-1 right-1 text-[8px] text-white/70 truncate">
                          {post.user?.firstName}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Nothing at all */}
              {!usersLoading && (!userResults || userResults.length === 0) && (!filteredPosts || filteredPosts.length === 0) && (
                <div className="flex flex-col items-center gap-3 py-12">
                  <SearchIcon className="w-10 h-10 text-zinc-700" />
                  <p className="text-sm text-zinc-500">No results found for "{searchQuery}"</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="browse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Books & News shortcut */}
              <div className="pt-4 pb-3">
                <Link href="/reading">
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                        <BookOpen className="w-6 h-6 text-red-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">Books & News</h3>
                        <p className="text-xs text-zinc-500">Read and listen with AI</p>
                      </div>
                    </div>
                    <Newspaper className="w-5 h-5 text-zinc-600" />
                  </motion.div>
                </Link>
              </div>

              {/* Explore grid — all posts */}
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">Explore</p>
              <div className="grid grid-cols-3 gap-0.5">
                {posts?.map((post, i) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className={`relative aspect-square bg-zinc-900 overflow-hidden ${i % 7 === 0 ? "col-span-2 row-span-2" : ""}`}
                  >
                    {post.imageUrl && !post.imageUrl.startsWith("blob:") ? (
                      <img src={post.imageUrl} alt="Explore" className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, hsl(${(post.id * 47) % 360}, 40%, 14%), hsl(${(post.id * 47 + 120) % 360}, 50%, 20%))` }}>
                        <span className="text-[8px] text-white/20 text-center px-1">{post.type}</span>
                      </div>
                    )}
                  </motion.div>
                )) || Array(12).fill(0).map((_, i) => (
                  <div key={i} className="aspect-square bg-zinc-900 animate-pulse" />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />
    </div>
  );
}
