import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Send, Bot, User } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useConversations, useCreateConversation, useChatStream, useConversation } from "@/hooks/use-chat";
import { cn } from "@/lib/utils";

export function AIChatDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversations } = useConversations();
  const { data: conversationData } = useConversation(activeConversationId);
  const createConversation = useCreateConversation();
  const { sendMessage, streamingContent, isStreaming } = useChatStream(activeConversationId);

  // Auto-create conversation if none exists
  useEffect(() => {
    if (isOpen && !activeConversationId && conversations && conversations.length > 0) {
      setActiveConversationId(conversations[0].id);
    }
  }, [isOpen, conversations, activeConversationId]);

  const handleCreateChat = async () => {
    const newChat = await createConversation.mutateAsync();
    setActiveConversationId(newChat.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeConversationId) return;
    
    const msg = input;
    setInput("");
    await sendMessage(msg);
  };

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversationData?.messages, streamingContent]);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          className="rounded-full shadow-lg bg-background border-primary/20 hover:border-primary hover:text-primary transition-all"
        >
          <Sparkles className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 h-full">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2 font-display">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Assistant
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-hidden relative">
          <div className="absolute inset-0 flex flex-col">
             {/* Chat Area */}
            <ScrollArea className="flex-1 p-4" ref={scrollRef}>
              <div className="space-y-4 pb-4 bg-[#000000c4]">
                {conversationData?.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex gap-3 max-w-[85%]",
                      msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      msg.role === "user" ? "bg-primary text-white" : "bg-muted"
                    )}>
                      {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className="p-3 rounded-2xl text-sm bg-muted text-foreground rounded-tl-sm font-bold">
                      {msg.content}
                    </div>
                  </div>
                ))}
                
                {isStreaming && (
                  <div className="flex gap-3 max-w-[85%] mr-auto">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="p-3 rounded-2xl rounded-tl-sm bg-muted text-foreground text-sm animate-pulse">
                      {streamingContent || "Thinking..."}
                    </div>
                  </div>
                )}
                
                {!activeConversationId && (
                  <div className="text-center text-muted-foreground mt-10">
                    <p>Start a new conversation to chat with AI.</p>
                    <Button onClick={handleCreateChat} variant="outline" className="mt-4">
                      Start Chat
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 bg-background border-t">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me anything..."
                  className="rounded-full pl-4"
                  disabled={isStreaming || !activeConversationId}
                />
                <Button 
                  type="submit" 
                  size="icon" 
                  className="rounded-full bg-primary hover:bg-primary/90"
                  disabled={!input.trim() || isStreaming}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
