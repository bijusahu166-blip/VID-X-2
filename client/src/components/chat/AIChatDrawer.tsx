import React, { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Send, Bot, Loader2, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/use-auth";

interface Message {
  role: "user" | "ai";
  content: string;
}

export function AIChatDrawer({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (open: boolean) => void }) {
  const [input, setInput] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();
  const { t, language } = useTranslation();
  const [mode, setMode] = useState<"classic" | "pro" | "ultra">("pro");
  const [messages, setMessages] = useState<Message[]>([
    { role: "ai", content: t("chat.welcome") },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic fixed for better reliability
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    setMessages((prev) => {
      if (!prev.length) return [{ role: "ai", content: t("chat.welcome") }];
      return prev.map((message, index) => (index === 0 ? { ...message, content: t("chat.welcome") } : message));
    });
  }, [language, t]);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const res = await apiRequest("POST", "/api/ai/chat", { message });

      // Agar backend error throw kare (500), toh use handle karein
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.reply || "Quantum Core Link Failed");
      }

      return res.json();
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "ai", content: data.reply }]);
    },
    onError: (error: Error) => {
      toast({
        title: "Neural Core Error",
        description: error.message, // Ab ye "Check API Key" ki jagah asli error batayega
        variant: "destructive",
      });
    }
  });

  const isPro = Boolean((user as any)?.isPro || (user as any)?.isPremium || (user as any)?.subscriptionStatus === "active");

  const handleSend = () => {
    const text = input.trim();
    if (!text || chatMutation.isPending) return;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    chatMutation.mutate(text);
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent
        side="bottom"
        className="h-[90vh] sm:h-[85vh] rounded-t-[40px] bg-black border-t-2 border-purple-500/50 text-white p-0 overflow-hidden shadow-[0_-15px_40px_rgba(168,85,247,0.3)] z-[100]"
      >

        {/* HEADER */}
        <div className="p-6 border-b border-white/10 bg-zinc-900/60 backdrop-blur-2xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative p-2.5 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl shadow-lg">
              <Bot className="text-white w-6 h-6" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 border-2 border-black rounded-full animate-pulse"></div>
            </div>
            <div>
              <SheetTitle className="text-white font-black text-2xl tracking-tighter italic leading-none">VAMPIRE NEURAL</SheetTitle>
              <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest mt-1">Quantum Logic V1.2</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-zinc-500 hover:text-white">
            <X size={24} />
          </Button>
        </div>

        {/* MESSAGES AREA */}
        <ScrollArea className="h-[calc(90vh-180px)] p-6 bg-black">
          <div className="space-y-6 pb-10">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[85%] p-4 rounded-3xl ${
                  m.role === "user"
                  ? "bg-gradient-to-br from-purple-600 to-indigo-700 text-white rounded-tr-none shadow-xl"
                  : "bg-zinc-900/90 border border-white/10 text-zinc-200 rounded-tl-none backdrop-blur-md"
                }`}>
                  <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}

            {chatMutation.isPending && (
              <div className="flex justify-start animate-in fade-in">
                <div className="bg-zinc-900/50 p-4 rounded-3xl border border-white/5 flex gap-3 items-center">
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                  <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Processing Neural Link...</span>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>

        {/* INPUT AREA */}
        <div className="p-6 bg-zinc-900/90 backdrop-blur-3xl border-t border-white/5 pb-12">
          {!isPro && (
            <div className="mb-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300">
              {t("chat.unlock")}
            </div>
          )}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">{t("chat.mode")}</span>
            {(["classic", "pro", "ultra"] as const).map((value) => (
              <button
                key={value}
                onClick={() => setMode(value)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${mode === value ? "bg-purple-600 text-white" : "bg-white/10 text-zinc-300"}`}
              >
                {value}
              </button>
            ))}
          </div>
          <div className={`rounded-2xl border p-1.5 transition-all shadow-inner ${isPro ? "border-purple-500/30 bg-black/50" : "border-white/10 bg-black/30"}`}>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="flex-1 bg-transparent border-none text-white text-base focus-visible:ring-0 placeholder:text-zinc-600 px-4"
              placeholder={isPro ? t("chat.placeholder") : t("chat.unlock")}
            />
            <Button
              onClick={handleSend}
              disabled={chatMutation.isPending || !isPro}
              className="mt-2 w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:scale-105 active:scale-95 p-6 rounded-xl transition-all shadow-lg"
            >
              {t("chat.button")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}