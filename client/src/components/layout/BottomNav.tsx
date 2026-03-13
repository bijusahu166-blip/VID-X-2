import { Link, useLocation } from "wouter";
import { Home, PlaySquare, MessageCircle, Search, User, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Search, label: "Explore", href: "/search" },
  { icon: Camera, label: "Filter", href: "#" },
  { icon: MessageCircle, label: "DMs", href: "/messages" },
  { icon: PlaySquare, label: "Reels", href: "/reels" },
  { icon: User, label: "Profile", href: "/profile" },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50">
      {/* Centered pill container */}
      <div className="flex justify-center pb-3 pt-1 px-4">
        <div className="flex items-center justify-between gap-1 bg-black rounded-2xl px-3 py-2 shadow-2xl w-full max-w-sm">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href !== "#" && item.href === location;

            const inner = (
              <div
                data-testid={`link-${item.label.toLowerCase()}`}
                className={cn(
                  "flex flex-col items-center justify-center w-11 h-11 rounded-xl transition-all duration-200",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "text-zinc-400 hover:text-white hover:bg-white/10"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[9px] mt-0.5 font-medium">{item.label}</span>
              </div>
            );

            if (item.href === "#") {
              return <div key={item.label}>{inner}</div>;
            }

            return (
              <Link key={item.href} href={item.href}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
