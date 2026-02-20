import { useState, useRef, useEffect } from "react";
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
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { BannerAd } from "@/components/ads/BannerAd";

interface Book {
  id: number;
  title: string;
  author: string | null;
  content: string;
  imageUrl: string | null;
  type: string;
}

export default function Reading() {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [voice, setVoice] = useState<"male" | "female">("female");
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const { toast } = useToast();
  const synth = window.speechSynthesis;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const { data: books, isLoading } = useQuery<Book[]>({
    queryKey: ["/api/books"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (newBook: any) => {
      const res = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBook),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/books"] });
      toast({ title: "Success", description: "Book uploaded successfully" });
    },
  });

  const handleFileUpload = () => {
    // Demo upload
    uploadMutation.mutate({
      title: "Sample High-Quality Book",
      author: "AI Author",
      content: "This is a high-quality book content for testing the AI reading aloud feature. It can be read by both male and female voices.",
      type: "book",
      imageUrl: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400"
    });
  };

  const togglePlayback = () => {
    if (!selectedBook) return;

    if (isReading) {
      synth.cancel();
      setIsReading(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(selectedBook.content);
      // Simple voice selection simulation
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
    // Simulate AI summarization
    setTimeout(() => {
      setSummary("This book discusses the intersection of technology and creativity, emphasizing the importance of human-like interaction in AI systems.");
      setIsSummarizing(false);
      toast({ title: "AI Summary Ready", description: "Content explained in simple terms." });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background pb-20 pt-14">
      <Header />
      
      <main className="p-4 max-w-md mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedBook && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => { setSelectedBook(null); setSummary(null); synth.cancel(); setIsReading(false); }}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
            <h1 className="text-2xl font-display font-bold">
              {selectedBook ? "Reading" : "Books & News"}
            </h1>
          </div>
          {!selectedBook && (
            <Button onClick={handleFileUpload} size="sm" className="gap-2 rounded-full">
              <Upload className="w-4 h-4" />
              Upload
            </Button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {!selectedBook ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-2 gap-4"
            >
              {isLoading ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="aspect-[3/4] bg-muted animate-pulse rounded-xl" />
                ))
              ) : (
                books?.map((book) => (
                  <Card 
                    key={book.id} 
                    className="overflow-hidden border-none shadow-md hover-elevate cursor-pointer"
                    onClick={() => setSelectedBook(book)}
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
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="aspect-[4/3] rounded-2xl bg-muted overflow-hidden">
                <img src={selectedBook.imageUrl || ""} alt={selectedBook.title} className="w-full h-full object-cover" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold">{selectedBook.title}</h2>
                <p className="text-muted-foreground">By {selectedBook.author}</p>
              </div>

              <div className="bg-muted/50 rounded-2xl p-6 text-lg leading-relaxed font-serif">
                {selectedBook.content}
              </div>

              <BannerAd placement="reading" />

              {/* Controls */}
              <Card className="border-border/50 bg-card/50 backdrop-blur">
                <CardContent className="p-4 space-y-4">
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

                  <div className="flex gap-2">
                    <Button variant="secondary" className="flex-1 gap-2 rounded-xl h-11" onClick={() => toast({ title: "Downloading...", description: "Book saved to your library" })}>
                      <Download className="w-4 h-4" /> Download
                    </Button>
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
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  );
}
