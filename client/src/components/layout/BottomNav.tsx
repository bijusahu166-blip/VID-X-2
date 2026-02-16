import { Link, useLocation } from "wouter";
import { Home, PlaySquare, MessageCircle, Search, User, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const [location] = useLocation();

  const navItems = [
    { icon: Home, label: "Home", href: "/" },
    { icon: Search, label: "Explore", href: "/search" },
    { icon: Camera, label: "Filter", href: "#", isFilter: true }, // Camera Filter Option
    { icon: MessageCircle, label: "DMs", href: "/messages" }, // Prime center spot
    { icon: PlaySquare, label: "Reels", href: "/reels" },
    { icon: User, label: "Profile", href: "/profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-lg border-t border-border pb-safe">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-1 font-extrabold bg-[#fffafa] text-center mt-[-57px] mb-[-57px] pl-[20px] pr-[20px] pt-[0px] pb-[0px] ml-[4px] mr-[4px]">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = item.href === location;
          
          const content = (
            <div
              className="flex flex-col items-center justify-center w-10 h-10 rounded-full transition-all duration-200 cursor-pointer text-muted-foreground hover:text-foreground bg-[#e60ff714]"
              data-testid={`link-${item.label.toLowerCase()}`}
            >
              <Icon className={cn("w-6 h-6", isActive && "fill-current", item.isFilter && "w-7 h-7")} />
              <span className="sr-only">{item.label}</span>
            </div>
          );

          if (item.href === "#") {
            return <div key={item.label}>{content}</div>;
          }

          return (
            <Link key={item.href} href={item.href}>
              {content}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
