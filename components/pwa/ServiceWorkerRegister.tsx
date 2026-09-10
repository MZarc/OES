'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Download, X } from 'lucide-react';

export function ServiceWorkerRegister() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // 1. Register Service Worker
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            // Service worker registered
          })
          .catch((error) => {
            console.warn('[PWA] ServiceWorker registration failed:', error);
          });
      });
    }

    // 2. Do not show if already in standalone app mode
    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true);

    if (isStandalone) return;

    // 3. Do not show if dismissed in this session
    const isDismissed = typeof window !== 'undefined' && sessionStorage.getItem('oes_pwa_dismissed') === 'true';
    if (isDismissed) return;

    // 4. Capture PWA Install Prompt (only when logged in - not on auth pages)
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);

      // Check current route: only prompt if user is logged in
      const currentPath = window.location.pathname;
      const isAuthPage = currentPath === '/login' || currentPath.startsWith('/activate');
      const alreadyDismissed = sessionStorage.getItem('oes_pwa_dismissed') === 'true';

      if (!isAuthPage && !alreadyDismissed) {
        setShowInstallBanner(true);
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Suppress on login and activate pages
  useEffect(() => {
    if (pathname === '/login' || pathname.startsWith('/activate')) {
      setShowInstallBanner(false);
    } else if (deferredPrompt && !sessionStorage.getItem('oes_pwa_dismissed')) {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      if (!isStandalone) {
        setShowInstallBanner(true);
      }
    }
  }, [pathname, deferredPrompt]);

  function handleDismiss() {
    setShowInstallBanner(false);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('oes_pwa_dismissed', 'true');
    }
  }

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('oes_pwa_dismissed', 'true');
        localStorage.setItem('oes_pwa_installed', 'true');
      }
    }
    setDeferredPrompt(null);
  }

  if (!showInstallBanner) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 max-w-sm w-full bg-white rounded-2xl p-4 shadow-2xl border border-slate-200 animate-slide-up flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <img src="/icon-192.png" alt="OES Icon" className="h-10 w-10 rounded-xl shadow-xs border border-slate-100 flex-shrink-0" />
        <div>
          <h4 className="text-xs font-bold text-slate-900">Install OES App</h4>
          <p className="text-[10px] text-slate-500">Install on your home screen for fast access.</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <button
          onClick={handleInstallClick}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-2xs"
        >
          <Download className="h-3.5 w-3.5" />
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          title="Dismiss for this session"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
