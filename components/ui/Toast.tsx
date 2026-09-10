'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  success: (message: string, title?: string, duration?: number) => void;
  error: (message: string, title?: string, duration?: number) => void;
  warning: (message: string, title?: string, duration?: number) => void;
  info: (message: string, title?: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', title?: string, duration = 4000) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, title?: string, duration?: number) =>
      showToast(message, 'success', title, duration),
    [showToast]
  );

  const error = useCallback(
    (message: string, title?: string, duration?: number) =>
      showToast(message, 'error', title, duration),
    [showToast]
  );

  const warning = useCallback(
    (message: string, title?: string, duration?: number) =>
      showToast(message, 'warning', title, duration),
    [showToast]
  );

  const info = useCallback(
    (message: string, title?: string, duration?: number) =>
      showToast(message, 'info', title, duration),
    [showToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info, removeToast }}>
      {children}

      {/* Floating Toast Notification Container (Top-Right on desktop, Top-Center on mobile) */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full px-3 sm:px-0"
      >
        {toasts.map((toast) => {
          const config = {
            success: {
              icon: CheckCircle2,
              bg: 'bg-white',
              border: 'border-emerald-200',
              text: 'text-slate-800',
              iconColor: 'text-emerald-600',
              accent: 'bg-emerald-500',
              shadow: 'shadow-emerald-500/10',
            },
            error: {
              icon: AlertCircle,
              bg: 'bg-white',
              border: 'border-rose-200',
              text: 'text-slate-800',
              iconColor: 'text-rose-600',
              accent: 'bg-rose-500',
              shadow: 'shadow-rose-500/10',
            },
            warning: {
              icon: AlertTriangle,
              bg: 'bg-white',
              border: 'border-amber-200',
              text: 'text-slate-800',
              iconColor: 'text-amber-500',
              accent: 'bg-amber-500',
              shadow: 'shadow-amber-500/10',
            },
            info: {
              icon: Info,
              bg: 'bg-white',
              border: 'border-blue-200',
              text: 'text-slate-800',
              iconColor: 'text-blue-600',
              accent: 'bg-blue-500',
              shadow: 'shadow-blue-500/10',
            },
          }[toast.type];

          const IconComponent = config.icon;

          return (
            <div
              key={toast.id}
              role="alert"
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-2xl border ${config.border} ${config.bg} shadow-xl ${config.shadow} backdrop-blur-md transition-all duration-300 animate-slide-up relative overflow-hidden`}
            >
              {/* Left Accent Bar */}
              <span className={`absolute left-0 top-0 bottom-0 w-1 ${config.accent}`} />

              <div className="flex-shrink-0 mt-0.5 ml-1">
                <IconComponent className={`h-5 w-5 ${config.iconColor}`} />
              </div>

              <div className="flex-1 min-w-0 pr-2">
                {toast.title && (
                  <h4 className="text-xs font-bold text-slate-900 leading-tight mb-0.5">
                    {toast.title}
                  </h4>
                )}
                <p className="text-xs font-medium text-slate-600 leading-relaxed break-words">
                  {toast.message}
                </p>
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                className="flex-shrink-0 rounded-lg p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 transition-colors"
                aria-label="Close notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
