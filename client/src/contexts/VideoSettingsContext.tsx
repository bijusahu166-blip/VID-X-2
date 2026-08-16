import { createContext, useContext, useState, useEffect } from "react";

export type VideoQuality = "auto" | "high" | "medium" | "low";

interface VideoSettings {
  dataSaver: boolean;
  quality: VideoQuality;
  setDataSaver: (v: boolean) => void;
  setQuality: (q: VideoQuality) => void;
}

const VideoSettingsContext = createContext<VideoSettings>({
  dataSaver: false,
  quality: "auto",
  setDataSaver: () => {},
  setQuality: () => {},
});

export function VideoSettingsProvider({ children }: { children: React.ReactNode }) {
  const [dataSaver, setDataSaverState] = useState<boolean>(() => {
    try { return localStorage.getItem("vs_dataSaver") === "true"; } catch { return false; }
  });
  const [quality, setQualityState] = useState<VideoQuality>(() => {
    try { return (localStorage.getItem("vs_quality") as VideoQuality) || "auto"; } catch { return "auto"; }
  });

  const setDataSaver = (v: boolean) => {
    setDataSaverState(v);
    try { localStorage.setItem("vs_dataSaver", String(v)); } catch {}
  };
  const setQuality = (q: VideoQuality) => {
    setQualityState(q);
    try { localStorage.setItem("vs_quality", q); } catch {}
  };

  return (
    <VideoSettingsContext.Provider value={{ dataSaver, quality, setDataSaver, setQuality }}>
      {children}
    </VideoSettingsContext.Provider>
  );
}

export function useVideoSettings() {
  return useContext(VideoSettingsContext);
}

