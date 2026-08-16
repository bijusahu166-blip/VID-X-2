import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Ad } from "@shared/schema";

export function NativeAd() {
  const { data: ads } = useQuery<Ad[]>({
    queryKey: ["/api/ads/feed"],
  });

  if (!ads?.length) return null;
  const ad = ads.find(a => a.type === 'native') || ads[0];

  return (
    <Card className="border-0 shadow-none sm:border sm:shadow-sm rounded-none sm:rounded-3xl mb-4 overflow-hidden bg-card">
      <CardHeader className="flex flex-row items-center space-x-4 p-4">
        <Avatar className="w-10 h-10 border-2 border-emerald-500">
          <AvatarFallback className="bg-emerald-100 text-emerald-700 font-bold text-xs">AD</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold">{ad.title}</p>
            <span className="text-[10px] text-muted-foreground px-1 border rounded">Sponsored</span>
          </div>
          <p className="text-xs text-muted-foreground">Promoted Content</p>
        </div>
      </CardHeader>
      <div className="aspect-square bg-muted cursor-pointer" onClick={() => window.open(ad.linkUrl, '_blank')}>
        {ad.imageUrl ? (
          <img src={ad.imageUrl} alt="Sponsored content" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">Ad Media</div>
        )}
      </div>
      <CardContent className="p-4 bg-emerald-50/10">
        <p className="text-sm font-semibold mb-1">{ad.title}</p>
        <p className="text-sm text-muted-foreground line-clamp-2">{ad.description}</p>
      </CardContent>
    </Card>
  );
}

