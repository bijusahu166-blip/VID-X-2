import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ExternalLink } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Ad } from "@shared/schema";

export function InterstitialAd({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [timeLeft, setTimeLeft] = useState(5);
  const { data: ads } = useQuery<Ad[]>({
    queryKey: ["/api/ads/transition"],
    enabled: open
  });

  useEffect(() => {
    if (open && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [open, timeLeft]);

  if (!ads?.length) return null;
  const ad = ads[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 sm:max-w-lg border-none bg-black overflow-hidden h-[80vh]">
        <div className="relative h-full flex flex-col items-center justify-center text-white">
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-4 right-4 text-white z-50 bg-black/50 hover:bg-black/80"
            onClick={() => onOpenChange(false)}
            disabled={timeLeft > 0}
          >
            {timeLeft > 0 ? timeLeft : <X className="w-5 h-5" />}
          </Button>
          
          <div className="absolute inset-0 z-0">
             {ad.imageUrl && <img src={ad.imageUrl} className="w-full h-full object-cover opacity-60" />}
          </div>

          <div className="relative z-10 p-8 text-center space-y-6">
            <span className="bg-emerald-500 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Sponsored</span>
            <h2 className="text-3xl font-black">{ad.title}</h2>
            <p className="text-lg opacity-90">{ad.description}</p>
            <Button 
              size="lg" 
              className="bg-white text-black hover:bg-gray-200 gap-2 font-bold px-8 rounded-full"
              onClick={() => window.open(ad.linkUrl, '_blank')}
            >
              LEARN MORE <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

