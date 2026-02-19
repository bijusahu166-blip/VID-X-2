import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { MessageSquare, Sparkles } from "lucide-react";
import { AIChatDrawer } from "@/components/chat/AIChatDrawer";

export default function Messages() {
  return (
    <div className="min-h-screen bg-background pb-20 pt-14">
      <Header />
      <main className="max-w-md mx-auto p-4 space-y-6">
        {/* AI Assistant Quick Access */}
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg">AI Assistant</h3>
              <p className="text-sm text-muted-foreground">Chat with your personal bot</p>
            </div>
          </div>
          <AIChatDrawer />
        </div>

        <div className="flex flex-col items-center justify-center py-10 text-center font-extrabold">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-bold mb-2">Direct Messages</h2>
          <p className="text-muted-foreground">Your conversations will appear here.</p>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
