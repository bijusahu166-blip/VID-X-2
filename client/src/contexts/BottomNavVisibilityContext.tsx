import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type BottomNavVisibilityContextValue = {
  hideBottomNav: () => void;
  showBottomNav: () => void;
  isHidden: boolean;
};

const BottomNavVisibilityContext =
  createContext<BottomNavVisibilityContextValue | null>(null);

export function BottomNavVisibilityProvider({ children }: { children: ReactNode }) {
  // A counter, not a boolean: more than one overlay can be "open" at once
  // (e.g. a report sheet opened from inside a comment sheet). Using a count
  // means the nav only comes back once EVERY overlay that asked for it to
  // hide has closed — a single overlay closing early won't prematurely
  // reveal the nav while another is still open underneath it.
  const hideCount = useRef(0);
  const [isHidden, setIsHidden] = useState(false);

  const hideBottomNav = useCallback(() => {
    hideCount.current += 1;
    setIsHidden(true);
  }, []);

  const showBottomNav = useCallback(() => {
    hideCount.current = Math.max(0, hideCount.current - 1);
    if (hideCount.current === 0) setIsHidden(false);
  }, []);

  return (
    <BottomNavVisibilityContext.Provider
      value={{ hideBottomNav, showBottomNav, isHidden }}
    >
      {children}
    </BottomNavVisibilityContext.Provider>
  );
}

export function useBottomNavVisibility() {
  const ctx = useContext(BottomNavVisibilityContext);
  if (!ctx) {
    throw new Error(
      "useBottomNavVisibility must be used within BottomNavVisibilityProvider"
    );
  }
  return ctx;
}

/**
 * Drop this into ANY component that opens a full-screen or bottom-docked
 * overlay — a chat thread, a settings panel, a comment sheet, a report
 * sheet — even if opening it does NOT change the URL. Pass the overlay's
 * own open/visible boolean; the bottom nav hides for as long as it's true
 * and automatically comes back when it closes or the component unmounts.
 *
 * Example:
 *   const [showSettings, setShowSettings] = useState(false);
 *   useHideBottomNavWhenOpen(showSettings);
 */
export function useHideBottomNavWhenOpen(open: boolean) {
  const { hideBottomNav, showBottomNav } = useBottomNavVisibility();

  useEffect(() => {
    if (!open) return;
    hideBottomNav();
    return () => showBottomNav();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
}