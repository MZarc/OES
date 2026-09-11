'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Globe, Mail, X, ExternalLink } from 'lucide-react';

export function Footer() {
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <>
      <footer className="mt-auto py-4 px-4 bg-white/80 backdrop-blur-xs border-t border-slate-200/80 text-center sm:hidden select-none">
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-600 font-medium">
          <Sparkles className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
          <span>Developed by</span>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent underline decoration-blue-300 underline-offset-2 hover:opacity-80 transition-opacity cursor-pointer focus:outline-none"
          >
            Meet Mistry
          </button>
        </div>
      </footer>

      {/* Developer Info Modal */}
      {showModal && mounted && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-fade-in"
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative my-auto w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-slate-200/90 space-y-4 animate-slide-up overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3.5">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-sm flex-shrink-0">
                MM
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                  Meet Mistry
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Developer
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">Software Engineer &amp; Designer</p>
              </div>
            </div>

            {/* Links & Info */}
            <div className="space-y-2.5 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Website:</span>
                  <a
                    href="https://meetmistry.vercel.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>meetmistry.vercel.app</span>
                    <ExternalLink className="h-3 w-3 text-blue-400" />
                  </a>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Email:</span>
                  <a
                    href="mailto:meetzarc@gmail.com"
                    className="font-semibold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>meetzarc@gmail.com</span>
                  </a>
                </div>
              </div>

              <div className="p-3 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 rounded-2xl border border-blue-100 text-[11px] text-slate-600 space-y-1">
                <div className="font-bold text-slate-800 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-blue-600" />
                  <span>Overtime &amp; Expense System (OES)</span>
                </div>
                <p className="text-slate-500">
                  Version 1.0 • Enterprise Employee Management Platform
                </p>
              </div>
            </div>

            {/* Action */}
            <div className="pt-1">
              <button
                onClick={() => setShowModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
