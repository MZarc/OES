'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Clock, ShieldAlert, LogOut } from 'lucide-react';

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const WARNING_THRESHOLD_MS = 9 * 60 * 1000;   // 9 minutes (1 minute warning)
const STORAGE_KEY = 'oes_last_active';

export function SessionInactivityWatchdog() {
  const pathname = usePathname();
  const router = useRouter();
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const isLoggingOut = useRef(false);

  const isPublicRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/activate') ||
    pathname.startsWith('/api/');

  const recordActivity = useCallback(() => {
    if (isPublicRoute || isLoggingOut.current) return;
    const now = Date.now();
    try {
      localStorage.setItem(STORAGE_KEY, String(now));
    } catch {
      // ignore storage quota issues
    }
    setSecondsRemaining(null);
  }, [isPublicRoute]);

  const performLogout = useCallback(async (reason = 'timeout') => {
    if (isLoggingOut.current) return;
    isLoggingOut.current = true;
    try {
      localStorage.clear();
      sessionStorage.clear();
      await fetch('/api/auth/custom-sign-out', { method: 'POST' }).catch(() => {});
      await fetch('/api/auth/sign-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).catch(() => {});
    } catch {
      // proceed with redirect even on network drop
    } finally {
      window.location.href = `/login?reason=${reason}`;
    }
  }, []);

  useEffect(() => {
    if (isPublicRoute) {
      setSecondsRemaining(null);
      return;
    }

    // Initialize activity timestamp if not present
    if (!localStorage.getItem(STORAGE_KEY)) {
      recordActivity();
    }

    // Throttled activity listener
    let lastRecorded = 0;
    function handleUserActivity() {
      const now = Date.now();
      if (now - lastRecorded > 3000) {
        lastRecorded = now;
        recordActivity();
      }
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    // Inactivity ticker (evaluates every 2.5 seconds)
    const interval = setInterval(() => {
      const lastActiveStr = localStorage.getItem(STORAGE_KEY);
      const lastActive = lastActiveStr ? parseInt(lastActiveStr, 10) : Date.now();
      const elapsed = Date.now() - lastActive;

      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        performLogout('timeout');
      } else if (elapsed >= WARNING_THRESHOLD_MS) {
        const remaining = Math.max(0, Math.ceil((INACTIVITY_TIMEOUT_MS - elapsed) / 1000));
        setSecondsRemaining(remaining);
      } else {
        setSecondsRemaining(null);
      }
    }, 2500);

    // Instant check upon tab focus or waking up system
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        const lastActiveStr = localStorage.getItem(STORAGE_KEY);
        if (lastActiveStr) {
          const elapsed = Date.now() - parseInt(lastActiveStr, 10);
          if (elapsed >= INACTIVITY_TIMEOUT_MS) {
            performLogout('timeout');
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [isPublicRoute, recordActivity, performLogout]);

  if (secondsRemaining === null || isPublicRoute) {
    return null;
  }

  return (
    <aside
      aria-label="Session Inactivity Warning"
      className="fixed bottom-4 right-4 z-50 max-w-sm w-full bg-amber-500 text-slate-950 p-4 rounded-2xl shadow-2xl border border-amber-400 flex items-start gap-3 animate-slide-up"
    >
      <div className="p-2 bg-amber-400 rounded-xl text-slate-950 flex-shrink-0 mt-0.5">
        <Clock className="h-5 w-5 animate-pulse" />
      </div>
      <div className="flex-1 text-xs">
        <div className="font-extrabold text-sm flex items-center justify-between">
          <span>Session Inactivity Notice</span>
          <span className="font-mono bg-amber-400/80 px-1.5 py-0.5 rounded text-[11px]">
            {secondsRemaining}s
          </span>
        </div>
        <p className="mt-1 font-medium leading-tight">
          You will be logged out automatically after 10 minutes of inactivity. Click anywhere to stay signed in.
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <button
            onClick={recordActivity}
            className="px-3 py-1 bg-slate-950 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors shadow-xs"
          >
            Stay Signed In
          </button>
          <button
            onClick={() => performLogout('manual')}
            className="px-2.5 py-1 text-slate-900 hover:text-red-950 text-xs font-semibold"
          >
            Sign Out Now
          </button>
        </div>
      </div>
    </aside>
  );
}
