import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { MessageSquare } from "lucide-react";

export default function Messages() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <Header />
      <main className="max-w-md mx-auto p-4">
        <div className="flex flex-col items-center justify-center py-20 text-center">
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
