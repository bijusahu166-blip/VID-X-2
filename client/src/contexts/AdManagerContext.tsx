import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { InterstitialAd } from '@/components/ads/InterstitialAd';
import { useAuth } from '@/hooks/use-auth';

interface AdManagerState {
  videoPlaybackTime: number; // in seconds
  statusViewCount: number;
  showAd: boolean;
}

interface AdManagerContextType {
  incrementVideoTime: (seconds: number) => void;
  incrementStatusView: () => void;
  resetStatusCounter: () => void;
}

const AdManagerContext = createContext<AdManagerContextType | null>(null);

const VIDEO_AD_INTERVAL = 6 * 60; // 6 minutes in seconds
const STATUS_AD_INTERVAL = 6; // every 6th status

export function AdManagerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<AdManagerState>({
    videoPlaybackTime: 0,
    statusViewCount: 0,
    showAd: false,
  });

  const incrementVideoTime = useCallback((seconds: number) => {
    setState(prev => {
      const newTime = prev.videoPlaybackTime + seconds;
      const shouldShowAd = newTime >= VIDEO_AD_INTERVAL && (newTime % VIDEO_AD_INTERVAL) < seconds;

      return {
        ...prev,
        videoPlaybackTime: newTime,
        showAd: shouldShowAd,
      };
    });
  }, []);

  const incrementStatusView = useCallback(() => {
    setState(prev => {
      const newCount = prev.statusViewCount + 1;
      const shouldShowAd = newCount % STATUS_AD_INTERVAL === 0;

      return {
        ...prev,
        statusViewCount: newCount,
        showAd: shouldShowAd,
      };
    });
  }, []);

  const resetStatusCounter = useCallback(() => {
    setState(prev => ({
      ...prev,
      statusViewCount: 0,
    }));
  }, []);

  const handleAdClose = useCallback(() => {
    setState(prev => ({
      ...prev,
      showAd: false,
    }));
  }, []);

  return (
    <AdManagerContext.Provider value={{
      incrementVideoTime,
      incrementStatusView,
      resetStatusCounter,
    }}>
      {children}
      {!((user as any)?.isPro || (user as any)?.subscriptionStatus === 'active') && (
        <InterstitialAd
          open={state.showAd}
          onOpenChange={handleAdClose}
        />
      )}
    </AdManagerContext.Provider>
  );
}

export function useAdManager() {
  const context = useContext(AdManagerContext);
  if (!context) {
    throw new Error('useAdManager must be used within AdManagerProvider');
  }
  return context;
}