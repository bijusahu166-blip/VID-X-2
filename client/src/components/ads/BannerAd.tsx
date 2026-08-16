import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Ad } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

export function BannerAd({ placement = "feed" }: { placement?: string }) {
  const { user } = useAuth();
  const { data: ads, isLoading } = useQuery<Ad[]>({
    queryKey: [`/api/ads/${placement}`],
  });

  if ((user as any)?.isPro || (user as any)?.subscriptionStatus === "active") return null;
  if (isLoading) return <Skeleton className="w-full h-20 rounded-xl" />;
  if (!ads?.length) return null;

  const ad = ads[0]; // Simplified for MVP

  return (
    <Card className="overflow-hidden border-none bg-muted/50 mb-4 cursor-pointer" onClick={() => window.open(ad.linkUrl, '_blank')}>
      <div className="flex h-20 items-center gap-4 px-4">
        {ad.imageUrl && (
          <img src={ad.imageUrl} alt={ad.title} className="w-16 h-16 object-cover rounded-lg" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-foreground/10 rounded uppercase">Ad</span>
            <h4 className="font-bold text-sm truncate">{ad.title}</h4>
          </div>
          <p className="text-xs text-muted-foreground truncate">{ad.description}</p>
        </div>
      </div>
    </Card>
  );
}

