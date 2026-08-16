import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ad } from '@shared/schema';

interface InterstitialAdState {
  isLoading: boolean;
  isShowing: boolean;
  ad: Ad | null;
}

export function useInterstitialAd(placement: string = 'interstitial') {
  const [state, setState] = useState<InterstitialAdState>({
    isLoading: false,
    isShowing: false,
    ad: null,
  });

  const { data: ads, isLoading: queryLoading } = useQuery<Ad[]>({
    queryKey: [`/api/ads/${placement}`],
    enabled: !state.ad, // Only fetch if no ad cached
  });

  const preloadAd = useCallback(() => {
    if (ads && ads.length > 0 && !state.ad) {
      setState(prev => ({
        ...prev,
        ad: ads[0], // Use first ad
      }));
    }
  }, [ads, state.ad]);

  useEffect(() => {
    preloadAd();
  }, [preloadAd]);

  const showAd = useCallback(() => {
    if (state.ad) {
      setState(prev => ({
        ...prev,
        isShowing: true,
      }));
    }
  }, [state.ad]);

  const closeAd = useCallback(() => {
    setState(prev => ({
      ...prev,
      isShowing: false,
      ad: null, // Clear ad after showing
    }));
  }, []);

  return {
    ...state,
    isLoading: queryLoading || state.isLoading,
    showAd,
    closeAd,
    preloadAd,
  };
}
