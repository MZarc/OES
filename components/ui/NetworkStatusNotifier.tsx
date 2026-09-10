'use client';

import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function NetworkStatusNotifier() {
  const [isOffline, setIsOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    function handleOffline() {
      setIsOffline(true);
      setShowReconnected(false);
    }

    function handleOnline() {
      setIsOffline(false);
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 4000);
      return () => clearTimeout(timer);
    }

    // Check initial online status
    if (typeof window !== 'undefined' && !navigator.onLine) {
      setIsOffline(true);
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  if (!isOffline && !showReconnected) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      {isOffline ? (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-amber-900/90 text-amber-100 text-xs font-semibold shadow-2xl backdrop-blur-xs border border-amber-700/50">
          <WifiOff className="h-4 w-4 text-amber-400 animate-pulse" />
          <span>You are currently offline. System changes will sync when connected.</span>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-900/90 text-emerald-100 text-xs font-semibold shadow-2xl backdrop-blur-xs border border-emerald-700/50">
          <Wifi className="h-4 w-4 text-emerald-400" />
          <span>Internet connection restored.</span>
        </div>
      )}
    </div>
  );
}
