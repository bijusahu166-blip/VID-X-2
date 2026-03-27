import { useState, useRef } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen,
  Upload,
  Download,
  Play,
  Pause,
  User,
  Volume2,
  Sparkles,
  ChevronLeft,
  Loader2,
  X,
  Image as ImageIcon,
  FileText,
  Search,
  Newspaper,
  TrendingUp,
  Clock,
  Globe,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BannerAd } from "@/components/ads/BannerAd";

interface Book {
  id: number;
  title: string;
  author: string | null;
  content: string;
  imageUrl: string | null;
  pdfUrl: string | null;
  type: string;
}

const NEWS_ARTICLES = [
  { id: 1, title: "AI Models Now Understand Human Emotions Better Than Ever", source: "TechCrunch", time: "2h ago", category: "Tech", image: "https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=400&h=220&fit=crop", summary: "New research shows large language models achieving 92% accuracy in recognizing nuanced human emotions across text and voice." },
  { id: 2, title: "World Cup 2026: Teams That Could Surprise Everyone", source: "ESPN", time: "4h ago", category: "Sports", image: "https://images.unsplash.com/photo-1540747913346-19212a4b423c?w=400&h=220&fit=crop", summary: "Analysts predict several underdog nations could advance further than expected in this year's World Cup." },
  { id: 3, title: "Netflix Announces 10 New Original Series for 2026", source: "Variety", time: "6h ago", category: "Entertainment", image: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=400&h=220&fit=crop", summary: "The streaming giant reveals a slate of diverse content spanning sci-fi, drama, and international productions." },
  { id: 4, title: "Global Markets Rally as Inflation Cools to 2-Year Low", source: "Reuters", time: "1h ago", category: "Business", image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=220&fit=crop", summary: "Stock markets worldwide surged after new data showed inflation falling to levels not seen since early 2024." },
  { id: 5, title: "Scientists Discover New Deep-Sea Species Near Pacific Trench", source: "Nature", time: "3h ago", category: "Science", image: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=400&h=220&fit=crop", summary: "Marine biologists identify over 12 new species during a deep-sea expedition to the Mariana Trench region." },
  { id: 6, title: "Electric Vehicle Sales Break Records in Q1 2026", source: "Bloomberg", time: "5h ago", category: "Tech", image: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=400&h=220&fit=crop", summary: "EV adoption accelerated dramatically in the first quarter, with sales up 48% compared to the same period last year." },
  { id: 7, title: "Grammy Awards 2026: Full List of Winners", source: "Billboard", time: "8h ago", category: "Entertainment", image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=220&fit=crop", summary: "Music's biggest night crowned artists across 94 categories, with several first-time winners making history." },
  { id: 8, title: "Breakthrough in Quantum Computing Achieves 1000-Qubit Processor", source: "MIT News", time: "12h ago", category: "Science", image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&h=220&fit=crop", summary: "Researchers demonstrated a 1,000-qubit processor that maintains coherence for record-breaking durations." },
];

const NEWS_CATEGORIES = ["All", "Tech", "Sports", "Entertainment", "Business", "Science"];

export default function Reading() {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [voice, setVoice] = useState<"male" | "female">("female");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [activeTab, setActiveTab] = useState<"books" | "news">("books");
  const [searchQuery, setSearchQuery] = useState("");
  const [newsCategory, setNewsCategory] = useState("All");
  const [selectedArticle, setSelectedArticle] = useState<typeof NEWS_ARTICLES[0] | null>(null);
  const { toast } = useToast();
  const synth = window.speechSynthesis;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Upload form state
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadAuthor, setUploadAuthor] = useState("");
  const [uploadContent, setUploadContent] = useState("");
  const [uploadCoverUrl, setUploadCoverUrl] = useState("");
  const [uploadCoverPreview, setUploadCoverPreview] = useState("");
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [uploadPdfUrl, setUploadPdfUrl] = useState("");
  const [uploadPdfName, setUploadPdfName] = useState("");
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const { data: books, isLoading } = useQuery<Book[]>({
    queryKey: ["/api/books"],
  });

  const historyMutation = useMutation({
    mutationFn: async (book: Book) => {
      await apiRequest("POST", "/api/history", {
        action: "view_book",
        targetId: book.id.toString(),
        metadata: `Read book: ${book.title}`,
      });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (newBook: any) => {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBook),
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      toast({ title: "Book uploaded!", description: "Your book is now in the library." });
      resetUploadForm();
      setShowUpload(false);
    },
    onError: () => {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    },
  });

  const resetUploadForm = () => {
    setUploadTitle("");
    setUploadAuthor("");
    setUploadContent("");
    setUploadCoverUrl("");
    setUploadCoverPreview("");
    setUploadPdfUrl("");
    setUploadPdfName("");
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!uploadTitle) {
      setUploadTitle(file.name.replace(/\.[^.]+$/, "").replace(/_/g, " "));
    }

    // PDF: upload to server
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setIsUploadingPdf(true);
      setUploadPdfName(file.name);
      try {
        const formData = new FormData();
        formData.append("pdf", file);
        const res = await fetch("/api/upload/book-pdf", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        setUploadPdfUrl(data.pdfUrl);
        toast({ title: "PDF uploaded!", description: `${file.name} is ready.` });
      } catch {
        toast({ title: "PDF upload failed", description: "Please try again.", variant: "destructive" });
        setUploadPdfName("");
      } finally {
        setIsUploadingPdf(false);
      }
      e.target.value = "";
      return;
    }

    // Text file: read as text
    setIsReadingFile(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setUploadContent(text || "");
      setIsReadingFile(false);
      toast({ title: "File loaded", description: `${text.length.toLocaleString()} characters read.` });
    };
    reader.onerror = () => {
      setIsReadingFile(false);
      toast({ title: "Could not read file", variant: "destructive" });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setUploadCoverPreview(dataUrl);
      setUploadCoverUrl(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!uploadPdfUrl && !uploadContent.trim()) {
      toast({ title: "Book content is required", description: "Upload a PDF or .txt file, or paste text.", variant: "destructive" });
      return;
    }
    uploadMutation.mutate({
      title: uploadTitle.trim(),
      author: uploadAuthor.trim() || "Unknown Author",
      content: uploadContent.trim() || "",
      type: "book",
      imageUrl: uploadCoverUrl || `https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400`,
      pdfUrl: uploadPdfUrl || null,
    });
  };

  const togglePlayback = () => {
    if (!selectedBook) return;
    if (isReading) {
      synth.cancel();
      setIsReading(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(selectedBook.content);
      const voices = synth.getVoices();
      if (voice === "male") {
        utterance.voice = voices.find(v => v.name.includes("Male") || v.name.includes("David")) || voices[0];
      } else {
        utterance.voice = voices.find(v => v.name.includes("Female") || v.name.includes("Zira")) || voices[1];
      }
      utterance.onend = () => setIsReading(false);
      utteranceRef.current = utterance;
      synth.speak(utterance);
      setIsReading(true);
    }
  };

  const handleSummarize = async () => {
    if (!selectedBook) return;
    setIsSummarizing(true);
    setTimeout(() => {
      setSummary("This book discusses the intersection of technology and creativity, emphasizing the importance of human-like interaction in AI systems.");
      setIsSummarizing(false);
      toast({ title: "AI Summary Ready", description: "Content explained in simple terms." });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background pb-28" style={{ paddingTop: "var(--header-total)" }}>
      <Header />

      <main className="p-4 max-w-md mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {(selectedBook || selectedArticle) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { setSelectedBook(null); setSelectedArticle(null); setSummary(null); synth.cancel(); setIsReading(false); }}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
            <h1 className="text-2xl font-display font-bold">
              {selectedBook ? "Reading" : selectedArticle ? "Article" : "Books & News"}
            </h1>
          </div>
          {!selectedBook && !selectedArticle && activeTab === "books" && (
            <Button onClick={() => setShowUpload(true)} size="sm" className="gap-2 rounded-full" data-testid="button-upload-book">
              <Upload className="w-4 h-4" />
              Upload
            </Button>
          )}
        </div>

        {/* Search bar — shown on library/news views */}
        {!selectedBook && !selectedArticle && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={activeTab === "books" ? "Search books by title or author…" : "Search news articles…"}
              data-testid="input-search-books"
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-zinc-900 border border-zinc-800 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>
        )}

        {/* Tabs: Books / News */}
        {!selectedBook && !selectedArticle && (
          <div className="flex gap-1 bg-zinc-900 p-1 rounded-xl">
            <button
              onClick={() => { setActiveTab("books"); setSearchQuery(""); }}
              data-testid="tab-books"
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "books" ? "bg-white text-black shadow" : "text-zinc-400 hover:text-white"}`}
            >
              <BookOpen className="w-4 h-4" /> Books
            </button>
            <button
              onClick={() => { setActiveTab("news"); setSearchQuery(""); }}
              data-testid="tab-news"
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === "news" ? "bg-white text-black shadow" : "text-zinc-400 hover:text-white"}`}
            >
              <Newspaper className="w-4 h-4" /> News
            </button>
          </div>
        )}

        {/* ── Upload Dialog ─────────────────────────────────────────── */}
        <AnimatePresence>
          {showUpload && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
              onClick={(e) => { if (e.target === e.currentTarget) setShowUpload(false); }}
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 26, stiffness: 300 }}
                className="w-full max-w-md rounded-t-3xl bg-zinc-950 border-t border-zinc-800 p-5 pb-10 max-h-[92vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-black text-white">Upload Book</h2>
                    <p className="text-xs text-zinc-500 mt-0.5">Add a book or article to the library</p>
                  </div>
                  <button onClick={() => { setShowUpload(false); resetUploadForm(); }} className="w-8 h-8 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  {/* Cover image */}
                  <div className="flex gap-3 items-start">
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      className="shrink-0 w-20 h-28 rounded-xl border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center gap-1 text-zinc-600 hover:border-zinc-500 hover:text-zinc-400 transition-colors overflow-hidden"
                    >
                      {uploadCoverPreview ? (
                        <img src={uploadCoverPreview} className="w-full h-full object-cover" alt="Cover" />
                      ) : (
                        <>
                          <ImageIcon className="w-5 h-5" />
                          <span className="text-[9px] font-semibold uppercase tracking-wider">Cover</span>
                        </>
                      )}
                    </button>
                    <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />

                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1 block">Title *</label>
                        <input
                          required
                          value={uploadTitle}
                          onChange={(e) => setUploadTitle(e.target.value)}
                          placeholder="Book title"
                          data-testid="input-book-title"
                          className="w-full h-10 px-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1 block">Author</label>
                        <input
                          value={uploadAuthor}
                          onChange={(e) => setUploadAuthor(e.target.value)}
                          placeholder="Author name"
                          data-testid="input-book-author"
                          className="w-full h-10 px-3 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* File upload area — PDF or TXT */}
                  <div>
                    <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Book File (PDF or TXT)</label>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-zinc-700 hover:border-zinc-500 transition-colors text-left"
                    >
                      {isReadingFile || isUploadingPdf ? (
                        <Loader2 className="w-5 h-5 text-red-400 animate-spin shrink-0" />
                      ) : (
                        <FileText className="w-5 h-5 text-zinc-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        {isUploadingPdf ? (
                          <p className="text-sm text-zinc-300">Uploading PDF…</p>
                        ) : isReadingFile ? (
                          <p className="text-sm text-zinc-300">Reading file…</p>
                        ) : uploadPdfUrl ? (
                          <p className="text-sm text-green-400 font-semibold truncate">✓ PDF ready: {uploadPdfName}</p>
                        ) : uploadContent ? (
                          <p className="text-sm text-green-400 font-semibold truncate">✓ {uploadContent.length.toLocaleString()} characters loaded</p>
                        ) : (
                          <>
                            <p className="text-sm text-zinc-300">Upload a PDF or .txt file</p>
                            <p className="text-[11px] text-zinc-600 mt-0.5">Tap to browse files</p>
                          </>
                        )}
                      </div>
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt,.text,.md,.rtf,application/pdf,text/plain,text/*"
                      className="hidden"
                      onChange={handleFileSelect}
                      data-testid="input-book-file"
                    />
                  </div>

                  {/* Manual paste fallback (only show for non-PDF) */}
                  {!uploadPdfUrl && (
                    <div>
                      <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 block">Or paste text directly</label>
                      <textarea
                        value={uploadContent}
                        onChange={(e) => setUploadContent(e.target.value)}
                        placeholder="Paste your book or article text here…"
                        data-testid="input-book-content"
                        rows={5}
                        className="w-full px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-red-500 transition-colors resize-none"
                      />
                      <p className="text-[10px] text-zinc-600 mt-1 text-right">{uploadContent.length.toLocaleString()} chars</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={uploadMutation.isPending || isReadingFile || isUploadingPdf || !uploadTitle.trim() || (!uploadPdfUrl && !uploadContent.trim())}
                    data-testid="button-submit-book"
                    className="w-full h-12 rounded-xl font-black text-sm uppercase tracking-widest text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{
                      background: "linear-gradient(135deg, #ef4444, #f97316)",
                      boxShadow: "0 0 20px rgba(239,68,68,0.3)",
                    }}
                  >
                    {uploadMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Uploading…</>
                    ) : (
                      <><Upload className="w-4 h-4" /> Add to Library</>
                    )}
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!selectedBook && !selectedArticle ? (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
            >
              {/* ── BOOKS TAB ── */}
              {activeTab === "books" && (() => {
                const filtered = (books ?? []).filter(b =>
                  !searchQuery.trim() ||
                  b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  (b.author ?? "").toLowerCase().includes(searchQuery.toLowerCase())
                );
                return (
                  <div className="grid grid-cols-2 gap-4">
                    {isLoading ? (
                      Array(4).fill(0).map((_, i) => (
                        <div key={i} className="aspect-[3/4] bg-muted animate-pulse rounded-xl" />
                      ))
                    ) : filtered.length > 0 ? (
                      filtered.map((book) => (
                        <Card
                          key={book.id}
                          className="overflow-hidden border-none shadow-md hover-elevate cursor-pointer"
                          onClick={() => { setSelectedBook(book); historyMutation.mutate(book); }}
                          data-testid={`card-book-${book.id}`}
                        >
                          <div className="aspect-[3/4] bg-muted relative">
                            {book.imageUrl ? (
                              <img src={book.imageUrl} alt={book.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <BookOpen className="w-8 h-8 text-muted-foreground" />
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                              <p className="text-xs text-white font-medium line-clamp-1">{book.title}</p>
                              {book.author && <p className="text-[9px] text-white/60 mt-0.5 line-clamp-1">{book.author}</p>}
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : searchQuery.trim() ? (
                      <div className="col-span-2 flex flex-col items-center justify-center py-16 text-zinc-600 gap-3">
                        <Search className="w-10 h-10 opacity-30" />
                        <p className="text-sm">No books matching "{searchQuery}"</p>
                        <button onClick={() => setSearchQuery("")} className="text-violet-400 text-sm font-semibold">Clear search</button>
                      </div>
                    ) : (
                      <div className="col-span-2 flex flex-col items-center justify-center py-16 text-zinc-600 gap-3">
                        <BookOpen className="w-12 h-12 opacity-30" />
                        <p className="text-sm">No books yet. Upload one to get started!</p>
                        <button onClick={() => setShowUpload(true)} className="mt-1 text-violet-400 text-sm font-semibold hover:text-violet-300 transition-colors">
                          + Upload a book
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ── NEWS TAB ── */}
              {activeTab === "news" && (() => {
                const filtered = NEWS_ARTICLES.filter(a =>
                  (newsCategory === "All" || a.category === newsCategory) &&
                  (!searchQuery.trim() || a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.source.toLowerCase().includes(searchQuery.toLowerCase()))
                );
                return (
                  <div className="space-y-4">
                    {/* Category chips */}
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                      {NEWS_CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setNewsCategory(cat)}
                          data-testid={`news-category-${cat}`}
                          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${newsCategory === cat ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    {filtered.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-zinc-600 gap-3">
                        <Newspaper className="w-12 h-12 opacity-30" />
                        <p className="text-sm">{searchQuery ? `No results for "${searchQuery}"` : "No news in this category"}</p>
                        <button onClick={() => { setSearchQuery(""); setNewsCategory("All"); }} className="text-violet-400 text-sm font-semibold">Clear filters</button>
                      </div>
                    ) : (
                      filtered.map((article) => (
                        <div
                          key={article.id}
                          className="rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 cursor-pointer active:scale-[0.98] transition-transform"
                          onClick={() => setSelectedArticle(article)}
                          data-testid={`card-news-${article.id}`}
                        >
                          <div className="relative h-40">
                            <img src={article.image} alt={article.title} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            <div className="absolute top-2 left-2">
                              <span className="text-[10px] font-bold bg-violet-600/90 text-white px-2 py-0.5 rounded-full">{article.category}</span>
                            </div>
                          </div>
                          <div className="p-3">
                            <p className="text-white font-bold text-sm leading-snug line-clamp-2">{article.title}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-[11px] text-violet-400 font-semibold">{article.source}</span>
                              <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                                <Clock className="w-3 h-3" /> {article.time}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                );
              })()}
            </motion.div>

          ) : selectedArticle ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-5"
            >
              <div className="relative rounded-2xl overflow-hidden h-48">
                <img src={selectedArticle.image} alt={selectedArticle.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3">
                  <span className="text-[10px] font-bold bg-violet-600 text-white px-2 py-0.5 rounded-full">{selectedArticle.category}</span>
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white leading-snug">{selectedArticle.title}</h2>
                <div className="flex items-center gap-3 mt-2">
                  <span className="flex items-center gap-1 text-sm text-violet-400 font-semibold">
                    <Globe className="w-3.5 h-3.5" /> {selectedArticle.source}
                  </span>
                  <span className="flex items-center gap-1 text-sm text-zinc-500">
                    <Clock className="w-3.5 h-3.5" /> {selectedArticle.time}
                  </span>
                </div>
              </div>
              <div className="bg-zinc-900 rounded-2xl p-5 border border-zinc-800">
                <p className="text-zinc-300 text-base leading-relaxed">{selectedArticle.summary}</p>
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <p className="text-zinc-500 text-sm leading-relaxed">
                    This article continues with analysis of related trends and their global implications. Industry experts weigh in on what this means for the future, and leading voices share their perspectives on upcoming developments in this space.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setSelectedArticle(null)} className="flex-1 h-11 rounded-xl bg-zinc-800 text-white font-semibold text-sm hover:bg-zinc-700 transition-colors">
                  Back to News
                </button>
                <button onClick={() => toast({ title: "Saved to reading list!" })} className="flex-1 h-11 rounded-xl bg-violet-600 text-white font-semibold text-sm hover:bg-violet-500 transition-colors">
                  Save Article
                </button>
              </div>
            </motion.div>
          ) : selectedBook ? (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Cover — only show if no PDF */}
              {!selectedBook.pdfUrl && (
                <div className="aspect-[4/3] rounded-2xl bg-muted overflow-hidden">
                  {selectedBook.imageUrl && (
                    <img src={selectedBook.imageUrl} alt={selectedBook.title} className="w-full h-full object-cover" />
                  )}
                </div>
              )}

              <div className="space-y-1">
                <h2 className="text-xl font-bold">{selectedBook.title}</h2>
                <p className="text-muted-foreground text-sm">By {selectedBook.author}</p>
              </div>

              {/* PDF Viewer */}
              {selectedBook.pdfUrl ? (
                <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950" style={{ height: "70vh" }}>
                  <iframe
                    src={selectedBook.pdfUrl}
                    title={selectedBook.title}
                    className="w-full h-full"
                    style={{ border: "none" }}
                    data-testid={`pdf-viewer-${selectedBook.id}`}
                  />
                </div>
              ) : (
                <div className="bg-muted/50 rounded-2xl p-6 text-lg leading-relaxed font-serif whitespace-pre-wrap">
                  {selectedBook.content || <span className="text-zinc-500 text-base italic">No content available.</span>}
                </div>
              )}

              <BannerAd placement="reading" />

              {/* Controls */}
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardContent className="p-4 space-y-4">
                  {/* Text-to-speech controls — only for text books */}
                  {!selectedBook.pdfUrl && (
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Button
                          variant={voice === "female" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setVoice("female")}
                          className="rounded-full gap-2"
                        >
                          <User className="w-4 h-4" /> Female
                        </Button>
                        <Button
                          variant={voice === "male" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setVoice("male")}
                          className="rounded-full gap-2"
                        >
                          <User className="w-4 h-4" /> Male
                        </Button>
                      </div>
                      <Button
                        onClick={togglePlayback}
                        size="icon"
                        className="w-12 h-12 rounded-full bg-primary shadow-lg shadow-primary/20"
                      >
                        {isReading ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {selectedBook.pdfUrl ? (
                      <Button
                        variant="secondary"
                        className="flex-1 gap-2 rounded-xl h-11"
                        onClick={() => window.open(selectedBook.pdfUrl!, "_blank")}
                      >
                        <Download className="w-4 h-4" /> Open PDF
                      </Button>
                    ) : (
                      <Button variant="secondary" className="flex-1 gap-2 rounded-xl h-11" onClick={() => toast({ title: "Downloading...", description: "Book saved to your library" })}>
                        <Download className="w-4 h-4" /> Download
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="flex-1 gap-2 rounded-xl h-11 border-primary/20 hover:bg-primary/5"
                      onClick={handleSummarize}
                      disabled={isSummarizing}
                    >
                      {isSummarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-primary" />}
                      Explain Content
                    </Button>
                  </div>

                  {summary && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="pt-4 border-t border-border/50"
                    >
                      <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <span className="text-xs font-bold uppercase tracking-wider text-primary">AI Explanation</span>
                        </div>
                        <p className="text-sm leading-relaxed">{summary}</p>
                      </div>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  );
}
