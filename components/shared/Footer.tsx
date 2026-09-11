'use client';

import { Sparkles, Globe, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="mt-auto py-5 px-4 bg-white/70 backdrop-blur-xs border-t border-slate-200/80 text-center sm:hidden select-none">
      <div className="flex flex-col items-center justify-center gap-1.5 text-xs text-slate-500">
        <div className="flex items-center gap-1.5 font-medium text-slate-700">
          <Sparkles className="h-3.5 w-3.5 text-blue-600" />
          <span>Developed by</span>
          <a
            href="https://meetmistry.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
          >
            Meet Mistry
          </a>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-0.5">
          <a
            href="https://meetmistry.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors"
          >
            <Globe className="h-3 w-3" />
            <span>meetmistry.vercel.app</span>
          </a>
          <span>•</span>
          <a
            href="mailto:meetzarc@gmail.com"
            className="inline-flex items-center gap-1 hover:text-blue-600 transition-colors"
          >
            <Mail className="h-3 w-3" />
            <span>meetzarc@gmail.com</span>
          </a>
        </div>

        <div className="text-[10px] text-slate-400 mt-0.5">
          Overtime &amp; Expense System • Enterprise Platform v1.0
        </div>
      </div>
    </footer>
  );
}
