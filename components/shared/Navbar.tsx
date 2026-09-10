'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Clock,
  Receipt,
  LayoutDashboard,
  Users,
  Sliders,
  FileText,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  Sparkles,
  ChevronRight,
  ChevronDown,
  User,
  Shield,
  Briefcase,
  Mail,
  SlidersHorizontal,
  Globe,
  Loader2,
} from 'lucide-react';

interface NavbarProps {
  userRole?: string;
  userName?: string;
  employeeCode?: string;
  userEmail?: string;
}

export function Navbar({ userRole = 'EMPLOYEE', userName = 'User', employeeCode, userEmail }: NavbarProps) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

  const employeeLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/ot/new', label: 'Log OT', icon: Clock },
    { href: '/ot/history', label: 'OT History', icon: FileText },
    { href: '/expenses/new', label: 'Submit Expense', icon: Receipt },
    { href: '/expenses/history', label: 'Expense History', icon: FileText },
  ];

  const adminLinks = [
    { href: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
    { href: '/admin/ot', label: 'OT Approvals', icon: Clock },
    { href: '/admin/expenses', label: 'Expenses', icon: Receipt },
    { href: '/admin/employees', label: 'Employees', icon: Users },
    { href: '/admin/rules/simulator', label: 'Simulator', icon: Sliders },
    { href: '/admin/reports', label: 'Reports', icon: FileText },
    { href: '/admin/audit', label: 'Audit Log', icon: ShieldAlert },
    { href: '/admin/mail', label: 'Mail System', icon: Mail },
    { href: '/admin/control-center', label: 'Control Center', icon: SlidersHorizontal },
  ];

  const inAdminSection = pathname.startsWith('/admin');
  const navLinks = isAdmin && inAdminSection ? adminLinks : employeeLinks;
  const initial = userName.trim().charAt(0).toUpperCase() || 'U';

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      await fetch('/api/auth/sign-out', { method: 'POST' });
    } finally {
      window.location.href = '/login?fresh=1';
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-xl transition-all">
      <div className="w-full flex h-14 items-center justify-between px-3 sm:px-4 lg:px-6 2xl:px-8">
        {/* Left: Brand Logo & Luxury Developer Credit */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div
            onClick={() => setShowInfoModal(true)}
            className="flex items-center gap-2.5 group cursor-pointer focus:outline-none flex-shrink-0 select-none p-1 rounded-xl hover:bg-slate-100/70 transition-colors"
            title="Click to view System Info & Developer Credits"
          >
            <img
              src="/icon-192.png"
              alt="OES Logo"
              style={{ width: '32px', height: '32px' }}
              className="h-8 w-8 rounded-lg object-contain shadow-2xs group-hover:scale-105 transition-transform flex-shrink-0"
            />
            <div className="flex items-center gap-2.5">
              <div className="flex flex-col leading-tight">
                <span className="font-extrabold tracking-tight text-slate-900 text-sm">
                  OES
                </span>
                <span className="text-[9px] font-semibold tracking-wider text-slate-400 uppercase">
                  {isAdmin && inAdminSection ? 'Admin Console' : 'Portal'}
                </span>
              </div>
              <div className="h-6 w-px bg-slate-200 hidden sm:block" />
              <div className="hidden sm:flex flex-col leading-tight text-left">
                <span className="text-[9px] font-medium text-slate-400 tracking-wider uppercase">
                  Developed by
                </span>
                <span className="text-[11px] font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Meet Mistry
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Perfectly Centered & Auto-Sized Navigation Tabs */}
        <nav className="hidden lg:flex items-center justify-center gap-1 xl:gap-1.5 flex-1 max-w-4xl mx-auto px-4">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold tracking-tight transition-all duration-150 whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                <span>{link.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Section: Circular Profile Thumbnail & Dropdown */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* User Profile Circular Thumbnail & Dropdown */}
          <div className="relative flex items-center" ref={dropdownRef}>
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="relative h-9 w-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xs shadow-xs ring-2 ring-slate-200/90 hover:ring-blue-500/50 transition-all cursor-pointer focus:outline-none"
              aria-label="User Profile"
              aria-expanded={userDropdownOpen}
              title={userName}
            >
              {initial}
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </button>

            {/* Profile Dropdown Menu (Opened cleanly under header with top-full) */}
            {userDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 border border-slate-200/90 p-2.5 text-xs z-[9999] animate-slide-up">
                <div className="p-3 border-b border-slate-100/80 bg-slate-50/70 rounded-xl mb-1 space-y-1">
                  <div className="font-bold text-slate-900 text-sm truncate">{userName}</div>
                  {userEmail && (
                    <div className="text-slate-500 text-[11px] flex items-center gap-1.5 truncate">
                      <Mail className="h-3 w-3 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{userEmail}</span>
                    </div>
                  )}
                  <div className="text-slate-500 text-[11px] flex items-center gap-1.5 pt-0.5">
                    <Briefcase className="h-3 w-3 text-slate-400 flex-shrink-0" />
                    <span>{employeeCode || 'Code: N/A'}</span>
                    <span>•</span>
                    <span className="font-semibold text-blue-600">{userRole}</span>
                  </div>
                </div>

                {isAdmin && (
                  <Link
                    href={inAdminSection ? '/dashboard' : '/admin/dashboard'}
                    onClick={() => setUserDropdownOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-slate-700 hover:bg-blue-50/80 hover:text-blue-700 font-semibold transition-colors"
                  >
                    <Sparkles className="h-4 w-4 text-blue-600 flex-shrink-0" />
                    <span>Switch to {inAdminSection ? 'Employee Portal' : 'Admin Console'}</span>
                  </Link>
                )}

                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-rose-600 hover:bg-rose-50/80 font-semibold transition-colors mt-1 disabled:opacity-50"
                >
                  {isSigningOut ? (
                    <Loader2 className="h-4 w-4 animate-spin text-rose-600 flex-shrink-0" />
                  ) : (
                    <LogOut className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden flex items-center justify-center h-9 w-9 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors focus:outline-none"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-2 shadow-xl animate-slide-up">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <div>
              <div className="text-xs font-bold text-slate-800">{userName}</div>
              {userEmail && <div className="text-[10px] text-slate-500 truncate">{userEmail}</div>}
              <div className="text-[10px] text-slate-400">
                {employeeCode ? `${employeeCode} • ` : ''}
                <span className="text-blue-600 font-semibold">{userRole}</span>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 disabled:opacity-50"
            >
              {isSigningOut ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-600" />
              ) : (
                <LogOut className="h-3.5 w-3.5" />
              )}
              <span>{isSigningOut ? 'Signing out...' : 'Sign Out'}</span>
            </button>
          </div>

          <div className="space-y-1 pt-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span>{link.label}</span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                </Link>
              );
            })}
          </div>

          {isAdmin && (
            <div className="pt-2 border-t border-slate-100">
              <Link
                href={inAdminSection ? '/dashboard' : '/admin/dashboard'}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold text-blue-700 bg-blue-50/70"
              >
                <span>Switch to {inAdminSection ? 'Employee Portal' : 'Admin Console'}</span>
                <ChevronRight className="h-3.5 w-3.5 text-blue-600" />
              </Link>
            </div>
          )}
        </div>
      )}

      {/* System Information & Developer Credits Modal */}
      {showInfoModal && mounted && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto animate-fade-in">
          <div className="relative my-auto w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200/90 space-y-5 animate-slide-up overflow-hidden">
            <button
              onClick={() => setShowInfoModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3.5 border-b border-slate-100 pb-4">
              <img
                src="/icon-192.png"
                alt="OES App Logo"
                className="h-12 w-12 rounded-2xl object-contain shadow-md border border-slate-100 flex-shrink-0"
              />
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                  Overtime & Expense System
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    v1.0
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">Enterprise Employee Management Platform</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
                <div className="font-bold text-slate-800 text-xs">System Architecture & Capabilities</div>
                <div className="text-[11px] text-slate-500 leading-relaxed">
                  Engineered with deterministic OT rule versioning, client-side WebP image optimization, Valkey BullMQ rate-limited email queues, and immutable append-only audit tracking.
                </div>
              </div>

              {/* Developer Credits Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 via-slate-50 to-indigo-50/80 border border-blue-100 space-y-2.5">
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <span>Developer Credits</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Developed By:</span>
                    <span className="font-bold text-slate-900">Meet Mistry</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Email:</span>
                    <a
                      href="mailto:meetzarc@gmail.com"
                      className="font-semibold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      meetzarc@gmail.com
                    </a>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Website:</span>
                    <a
                      href="https://meetmistry.vercel.app"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-blue-600 hover:underline flex items-center gap-1"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      meetmistry.vercel.app
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 text-center">
              <button
                onClick={() => setShowInfoModal(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition-colors shadow-xs"
              >
                Close Information
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
}
