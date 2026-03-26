import { useState, useRef, useEffect } from "react";
import { Music, Search, Play, Pause, X, Check, Film, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

export interface Song {
  id: number;
  title: string;
  artist: string;
  genre: string;
  duration: string;
  color: string;
  audioUrl?: string;
}

// Route all audio through our server proxy to avoid CORS issues
function proxyAudio(num: number) {
  const src = `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${num}.mp3`;
  return `/api/audio-proxy?url=${encodeURIComponent(src)}`;
}

export const SONG_LIBRARY: Song[] = [
  { id: 1,  title: "Kesariya",               artist: "Arijit Singh",        genre: "Bollywood", duration: "3:42", color: "#f97316", audioUrl: proxyAudio(1) },
  { id: 2,  title: "Raataan Lambiyan",        artist: "Jubin Nautiyal",      genre: "Bollywood", duration: "3:58", color: "#ec4899", audioUrl: proxyAudio(2) },
  { id: 3,  title: "Tum Hi Ho",               artist: "Arijit Singh",        genre: "Bollywood", duration: "4:22", color: "#a855f7", audioUrl: proxyAudio(3) },
  { id: 4,  title: "Apna Bana Le",            artist: "Arijit Singh",        genre: "Bollywood", duration: "3:31", color: "#f59e0b", audioUrl: proxyAudio(4) },
  { id: 5,  title: "Ik Vaari Aa",             artist: "Arijit Singh",        genre: "Bollywood", duration: "3:47", color: "#22c55e", audioUrl: proxyAudio(5) },
  { id: 6,  title: "Channa Mereya",           artist: "Arijit Singh",        genre: "Bollywood", duration: "4:49", color: "#06b6d4", audioUrl: proxyAudio(6) },
  { id: 7,  title: "Bekhayali",               artist: "Sachet Tandon",       genre: "Bollywood", duration: "5:25", color: "#3b82f6", audioUrl: proxyAudio(7) },
  { id: 8,  title: "Hawayein",                artist: "Arijit Singh",        genre: "Bollywood", duration: "4:36", color: "#e879f9", audioUrl: proxyAudio(8) },
  { id: 9,  title: "Photograph",              artist: "Ed Sheeran",          genre: "Pop",       duration: "4:19", color: "#f97316", audioUrl: proxyAudio(9) },
  { id: 10, title: "Blinding Lights",         artist: "The Weeknd",          genre: "Pop",       duration: "3:20", color: "#ef4444", audioUrl: proxyAudio(10) },
  { id: 11, title: "As It Was",               artist: "Harry Styles",        genre: "Pop",       duration: "2:37", color: "#8b5cf6", audioUrl: proxyAudio(11) },
  { id: 12, title: "Levitating",              artist: "Dua Lipa",            genre: "Pop",       duration: "3:23", color: "#06b6d4", audioUrl: proxyAudio(12) },
  { id: 13, title: "Flowers",                 artist: "Miley Cyrus",         genre: "Pop",       duration: "3:21", color: "#22c55e", audioUrl: proxyAudio(13) },
  { id: 14, title: "Anti-Hero",               artist: "Taylor Swift",        genre: "Pop",       duration: "3:21", color: "#ec4899", audioUrl: proxyAudio(14) },
  { id: 15, title: "Good 4 U",                artist: "Olivia Rodrigo",      genre: "Pop",       duration: "2:58", color: "#f59e0b", audioUrl: proxyAudio(15) },
  { id: 16, title: "Stay",                    artist: "The Kid LAROI",       genre: "Pop",       duration: "2:21", color: "#a855f7", audioUrl: proxyAudio(16) },
  { id: 17, title: "Heat Waves",              artist: "Glass Animals",       genre: "Pop",       duration: "3:59", color: "#3b82f6", audioUrl: proxyAudio(17) },
  { id: 18, title: "SICKO MODE",              artist: "Travis Scott",        genre: "Hip Hop",   duration: "5:13", color: "#1e1b4b", audioUrl: proxyAudio(1) },
  { id: 19, title: "God's Plan",              artist: "Drake",               genre: "Hip Hop",   duration: "3:18", color: "#7c3aed", audioUrl: proxyAudio(2) },
  { id: 20, title: "Humble",                  artist: "Kendrick Lamar",      genre: "Hip Hop",   duration: "2:57", color: "#c2410c", audioUrl: proxyAudio(3) },
  { id: 21, title: "Rockstar",                artist: "Post Malone",         genre: "Hip Hop",   duration: "3:38", color: "#0f172a", audioUrl: proxyAudio(4) },
  { id: 22, title: "Old Town Road",           artist: "Lil Nas X",           genre: "Hip Hop",   duration: "1:53", color: "#92400e", audioUrl: proxyAudio(5) },
  { id: 23, title: "Numb",                    artist: "Linkin Park",         genre: "Rock",      duration: "3:06", color: "#1f2937", audioUrl: proxyAudio(6) },
  { id: 24, title: "Bohemian Rhapsody",       artist: "Queen",               genre: "Rock",      duration: "5:55", color: "#7f1d1d", audioUrl: proxyAudio(7) },
  { id: 25, title: "Mr. Brightside",          artist: "The Killers",         genre: "Rock",      duration: "3:42", color: "#1e3a5f", audioUrl: proxyAudio(8) },
  { id: 26, title: "Sunflower",               artist: "Post Malone",         genre: "Chill",     duration: "2:38", color: "#fbbf24", audioUrl: proxyAudio(9) },
  { id: 27, title: "lofi hip hop",            artist: "Chillhop Music",      genre: "Chill",     duration: "3:02", color: "#4f46e5", audioUrl: proxyAudio(10) },
  { id: 28, title: "Weightless",              artist: "Marconi Union",       genre: "Chill",     duration: "8:09", color: "#0369a1", audioUrl: proxyAudio(11) },
  { id: 29, title: "Clair de Lune",           artist: "Claude Debussy",      genre: "Chill",     duration: "5:00", color: "#6d28d9", audioUrl: proxyAudio(12) },
  { id: 30, title: "Midnight Rain",           artist: "Taylor Swift",        genre: "Chill",     duration: "3:41", color: "#1e1b4b", audioUrl: proxyAudio(13) },
  { id: 31, title: "Starter Pack",            artist: "Jimin BTS",           genre: "K-Pop",     duration: "2:58", color: "#be185d", audioUrl: proxyAudio(14) },
  { id: 32, title: "Dynamite",                artist: "BTS",                 genre: "K-Pop",     duration: "3:19", color: "#d97706", audioUrl: proxyAudio(15) },
  { id: 33, title: "LALISA",                  artist: "LISA",                genre: "K-Pop",     duration: "3:28", color: "#9333ea", audioUrl: proxyAudio(16) },
  { id: 34, title: "Fancy",                   artist: "TWICE",               genre: "K-Pop",     duration: "3:34", color: "#db2777", audioUrl: proxyAudio(17) },
  { id: 35, title: "Butter",                  artist: "BTS",                 genre: "K-Pop",     duration: "2:45", color: "#f59e0b", audioUrl: proxyAudio(1) },
  { id: 36, title: "Escape",                  artist: "NF",                  genre: "Trending",  duration: "3:53", color: "#374151", audioUrl: proxyAudio(2) },
  { id: 37, title: "Dreaming",                artist: "OMG",                 genre: "Trending",  duration: "2:54", color: "#7c3aed", audioUrl: proxyAudio(3) },
  { id: 38, title: "Industry Baby",           artist: "Lil Nas X",           genre: "Trending",  duration: "3:33", color: "#1d4ed8", audioUrl: proxyAudio(4) },
  { id: 39, title: "Bad Guy",                 artist: "Billie Eilish",       genre: "Trending",  duration: "3:14", color: "#166534", audioUrl: proxyAudio(5) },
  { id: 40, title: "Jhol",                    artist: "Maanu ft. Aakanksha", genre: "Trending",  duration: "3:47", color: "#9f1239", audioUrl: proxyAudio(6) },
];

const GENRES = ["All", "Trending", "Bollywood", "Pop", "Hip Hop", "K-Pop", "Rock", "Chill"];

interface SongPickerProps {
  onSelect: (song: Song | null) => void;
  selectedSong?: Song | null;
  onClose: () => void;
}

export function SongPicker({ onSelect, selectedSong, onClose }: SongPickerProps) {
  const [search, setSearch] = useState("");
  const [genre, setGenre] = useState("All");
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: reelSongs = [] } = useQuery<any[]>({
    queryKey: ["/api/posts/reel-songs"],
    queryFn: () => fetch("/api/posts/reel-songs", { credentials: "include" }).then(r => r.json()),
  });

  const filtered = SONG_LIBRARY.filter(s => {
    const matchesGenre = genre === "All" || s.genre === genre;
    const matchesSearch = !search || s.title.toLowerCase().includes(search.toLowerCase()) || s.artist.toLowerCase().includes(search.toLowerCase());
    return matchesGenre && matchesSearch;
  });

  const togglePlay = (song: Song) => {
    if (!song.audioUrl) return;
    if (playingId === song.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      setLoadingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setPlayingId(null);
    setLoadingId(song.id);
    const audio = new Audio(song.audioUrl);
    audioRef.current = audio;
    audio.volume = 0.7;
    audio.oncanplay = () => {
      setLoadingId(null);
      setPlayingId(song.id);
    };
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      setLoadingId(null);
      setPlayingId(null);
    };
    audio.load();
    audio.play().catch(() => {
      setLoadingId(null);
      setPlayingId(null);
    });
  };

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-[300] flex items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative w-full bg-zinc-950 rounded-t-3xl border-t border-zinc-800 flex flex-col"
        style={{ maxHeight: "80vh" }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-zinc-700" />
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-violet-400" />
            <span className="text-white font-black text-sm">Music Library</span>
            <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full">{SONG_LIBRARY.length} songs</span>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center">
            <X className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>

        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search songs, artists…"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-full pl-8 pr-4 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-violet-500"
              data-testid="input-search-songs"
            />
          </div>
        </div>

        <div className="px-4 pb-2 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 w-max">
            {GENRES.map(g => (
              <button
                key={g}
                onClick={() => setGenre(g)}
                className="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap"
                style={{
                  background: genre === g ? "#7c3aed" : "rgba(255,255,255,0.06)",
                  color: genre === g ? "#fff" : "#71717a",
                }}
                data-testid={`genre-${g}`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-1">
          {/* Trending in Reels section */}
          {reelSongs.length > 0 && !search && genre === "All" && (
            <div className="mb-3">
              <div className="flex items-center gap-1.5 py-2">
                <Film className="w-3 h-3 text-pink-400" />
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Trending in Reels</span>
              </div>
              <div className="space-y-1">
                {reelSongs.slice(0, 5).map((rs: any) => {
                  const reelSong: Song = {
                    id: -(rs.id),
                    title: rs.song_title,
                    artist: rs.song_artist,
                    genre: "Trending",
                    duration: "",
                    color: rs.song_color || "#ec4899",
                  };
                  const isSelected = selectedSong?.title === rs.song_title && selectedSong?.artist === rs.song_artist;
                  return (
                    <div
                      key={`reel-${rs.id}`}
                      className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
                      style={{
                        background: isSelected ? "rgba(236,72,153,0.15)" : "rgba(255,255,255,0.03)",
                        border: isSelected ? "1px solid rgba(236,72,153,0.4)" : "1px solid transparent",
                      }}
                      onClick={() => onSelect(isSelected ? null : reelSong)}
                      data-testid={`reel-song-${rs.id}`}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                        style={{ background: `${rs.song_color || "#ec4899"}33` }}
                      >
                        🎬
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-[13px] font-bold truncate">{rs.song_title}</p>
                        <p className="text-zinc-400 text-[11px] truncate">{rs.song_artist} · by @{rs.username}</p>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-pink-400 shrink-0" />}
                    </div>
                  );
                })}
              </div>
              <div className="h-[1px] bg-zinc-800 my-2" />
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-8 text-zinc-500 text-sm">No songs found</div>
          )}
          {filtered.map(song => {
            const isSelected = selectedSong?.id === song.id;
            const isPlaying = playingId === song.id;
            const isLoading = loadingId === song.id;
            return (
              <div
                key={song.id}
                className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all active:scale-[0.98]"
                style={{
                  background: isSelected ? "rgba(124,58,237,0.15)" : "rgba(255,255,255,0.03)",
                  border: isSelected ? "1px solid rgba(124,58,237,0.4)" : "1px solid transparent",
                }}
                onClick={() => onSelect(isSelected ? null : song)}
                data-testid={`song-${song.id}`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 relative"
                  style={{ background: `${song.color}33`, border: `1px solid ${song.color}44` }}
                >
                  🎵
                  {(isPlaying || isLoading) && (
                    <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center">
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      ) : (
                        <div className="flex gap-0.5 items-end">
                          {[0, 1, 2].map(i => (
                            <div key={i} className="w-0.5 bg-white rounded-full animate-bounce" style={{ height: 8 + i * 4, animationDelay: `${i * 0.12}s` }} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-white text-[13px] font-bold truncate">{song.title}</p>
                  <p className="text-zinc-400 text-[11px] truncate">{song.artist}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-zinc-600">{song.duration}</span>
                  {song.audioUrl && (
                    <button
                      onClick={e => { e.stopPropagation(); togglePlay(song); }}
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-all"
                      style={{ background: (isPlaying || isLoading) ? "#7c3aed" : "rgba(255,255,255,0.1)" }}
                      data-testid={`play-song-${song.id}`}
                      disabled={isLoading}
                    >
                      {isLoading
                        ? <Loader2 className="w-3 h-3 text-white animate-spin" />
                        : isPlaying
                          ? <Pause className="w-3 h-3 text-white" />
                          : <Play className="w-3 h-3 text-white" />}
                    </button>
                  )}
                  {isSelected && <Check className="w-4 h-4 text-violet-400" />}
                </div>
              </div>
            );
          })}
        </div>

        {selectedSong && (
          <div className="px-4 pb-safe-bottom py-3 border-t border-zinc-800 flex items-center gap-3 bg-zinc-950">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
              style={{ background: `${selectedSong.color}33` }}
            >
              🎵
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-bold truncate">{selectedSong.title}</p>
              <p className="text-zinc-400 text-[10px] truncate">{selectedSong.artist}</p>
            </div>
            <button
              onClick={() => { onSelect(selectedSong); onClose(); }}
              className="bg-violet-600 text-white text-xs font-black px-4 py-2 rounded-full"
              data-testid="button-use-song"
            >
              Use
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
