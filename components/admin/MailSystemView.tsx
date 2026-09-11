'use client';

import { useState, useEffect, useRef } from 'react';
import { Pagination } from '@/components/ui/Pagination';
import {
  getMailSystemStatusAction,
  sendTestEmailAction,
  getActiveVerificationTokensAction,
  resendTokenEmailAction,
  getActivationLinkAction,
  saveSmtpConfigAction,
  getRegistrationStatusAction,
  sendEmployeeInvitationAction,
  sendBulkEmployeeInvitationsAction,
  MailSystemStatus,
  PendingEmployeeItem,
  DoneEmployeeItem,
} from '@/app/actions/mail';
import { formatDateTimeDisplay } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import {
  Mail,
  Server,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Send,
  RefreshCw,
  ExternalLink,
  Settings,
  X,
  Copy,
  Check,
  UserCheck,
  Sparkles,
  Info,
  Eye,
  EyeOff,
  ShieldCheck,
  Search,
  Users,
  Clock,
} from 'lucide-react';

interface MailSystemViewProps {
  initialStatus?: MailSystemStatus;
}

export function MailSystemView({ initialStatus }: MailSystemViewProps) {
  const toast = useToast();
  const [status, setStatus] = useState<MailSystemStatus | null>(initialStatus || null);
  const [loading, setLoading] = useState(!initialStatus);

  // Registration Workflow Tab State
  const [activeRegTab, setActiveRegTab] = useState<'pending' | 'done'>('pending');
  const [pendingEmployees, setPendingEmployees] = useState<PendingEmployeeItem[]>([]);
  const [doneEmployees, setDoneEmployees] = useState<DoneEmployeeItem[]>([]);
  const [selectedPendingIds, setSelectedPendingIds] = useState<string[]>([]);
  const [bulkSendingInvites, setBulkSendingInvites] = useState(false);
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const [regSearchTerm, setRegSearchTerm] = useState('');

  // Pagination
  const [regPage, setRegPage] = useState(1);
  const [regPageSize, setRegPageSize] = useState(10);

  // Test Email State
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ success: boolean; message: string; time: string } | null>(null);

  // Per-row Action States
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // SMTP Settings Form State
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activePreset, setActivePreset] = useState<'gmail' | 'brevo' | 'mailpit' | 'custom'>('custom');

  // CRITICAL: Prevent form state from ever being overwritten by background updates
  const hasLoadedInitialForm = useRef(false);

  const [smtpForm, setSmtpForm] = useState({
    host: initialStatus?.smtp.host || 'smtp.gmail.com',
    port: initialStatus?.smtp.port || 465,
    user: initialStatus?.smtp.user || '',
    pass: '',
    from: initialStatus?.smtp.from || 'OES Notifications <no-reply@oes.local>',
  });

  async function loadData(showSpinner = true) {
    if (showSpinner) setLoading(true);
    try {
      const [st, regData] = await Promise.all([
        getMailSystemStatusAction(),
        getRegistrationStatusAction(),
      ]);
      setStatus(st);
      setPendingEmployees(regData.pending);
      setDoneEmployees(regData.done);

      // ONLY pre-fill form on the very first initial load, NEVER overwrite while the user is typing!
      if (!hasLoadedInitialForm.current && st.smtp) {
        hasLoadedInitialForm.current = true;
        setSmtpForm({
          host: st.smtp.host || 'smtp.gmail.com',
          port: st.smtp.port || 465,
          user: st.smtp.user || '',
          pass: '',
          from: st.smtp.from || 'OES Notifications <no-reply@oes.local>',
        });

        if (st.smtp.host === 'smtp.gmail.com') setActivePreset('gmail');
        else if (st.smtp.host === 'smtp-relay.brevo.com') setActivePreset('brevo');
        else if (st.smtp.host === 'localhost') setActivePreset('mailpit');
        else setActivePreset('custom');
      }
    } catch (err: any) {
      if (showSpinner) toast.error(err.message || 'Failed to load mail system status.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }

  useEffect(() => {
    loadData(true);
  }, []);

  // One-click SMTP preset selector
  function applyPreset(preset: 'gmail' | 'brevo' | 'mailpit' | 'custom') {
    setActivePreset(preset);
    if (preset === 'gmail') {
      setSmtpForm((prev) => ({
        ...prev,
        host: 'smtp.gmail.com',
        port: 465,
        from: prev.user && prev.user.includes('@') ? `OES Notifications <${prev.user}>` : prev.from,
      }));
    } else if (preset === 'brevo') {
      setSmtpForm((prev) => ({
        ...prev,
        host: 'smtp-relay.brevo.com',
        port: 587,
      }));
    } else if (preset === 'mailpit') {
      setSmtpForm((prev) => ({
        ...prev,
        host: 'localhost',
        port: 1025,
        user: '',
        pass: '',
        from: 'OES Notifications <no-reply@oes.local>',
      }));
    }
  }

  async function handleSendTestEmail(e: React.FormEvent) {
    e.preventDefault();
    const target = testEmail.trim();
    if (!target || !target.includes('@')) {
      toast.error('Please enter a valid target email address.');
      return;
    }

    setSendingTest(true);
    setTestFeedback(null);
    try {
      const res = await sendTestEmailAction(target);
      const timeStr = new Date().toLocaleTimeString();
      toast.success(`Test email sent successfully to ${target}!`);
      setTestFeedback({
        success: true,
        message: `Successfully delivered to ${target} (Message ID: ${res.messageId})`,
        time: timeStr,
      });
    } catch (err: any) {
      const timeStr = new Date().toLocaleTimeString();
      toast.error(err.message || 'Failed to send test email.');
      setTestFeedback({
        success: false,
        message: err.message || 'Failed to deliver test email. Check your SMTP credentials.',
        time: timeStr,
      });
    } finally {
      setSendingTest(false);
    }
  }

  async function handleSendSingleInvite(empId: string, email: string) {
    setSendingInviteId(empId);
    try {
      await sendEmployeeInvitationAction(empId);
      toast.success(`Activation invite dispatched to ${email}!`);
      await loadData(false);
    } catch (err: any) {
      toast.error(err.message || `Failed to send invite to ${email}.`);
    } finally {
      setSendingInviteId(null);
    }
  }

  async function handleSendBulkInvites() {
    if (selectedPendingIds.length === 0) return;
    setBulkSendingInvites(true);
    try {
      const res = await sendBulkEmployeeInvitationsAction(selectedPendingIds);
      if (res.failureCount === 0) {
        toast.success(`Successfully sent activation invites to all ${res.successCount} employee(s)!`);
      } else {
        toast.warning(`Sent ${res.successCount} invitation(s). ${res.failureCount} failed.`);
      }
      setSelectedPendingIds([]);
      await loadData(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to send bulk invitations.');
    } finally {
      setBulkSendingInvites(false);
    }
  }

  async function handleCopyActivationLink(tokenId: string | null, email: string, tokenValue?: string | null) {
    try {
      let url = '';
      if (tokenId) {
        const res = await getActivationLinkAction(tokenId);
        url = res.activationUrl;
      } else if (tokenValue) {
        const baseUrl = window.location.origin;
        url = `${baseUrl}/activate?email=${encodeURIComponent(email)}&token=${tokenValue}`;
      }

      if (url) {
        await navigator.clipboard.writeText(url);
        setCopiedId(tokenId || email);
        toast.success(`Activation link copied for ${email}!`);
        setTimeout(() => setCopiedId(null), 2500);
      } else {
        toast.info(`Please send an invitation first to generate an activation link for ${email}.`);
      }
    } catch (err: any) {
      toast.error('Failed to copy activation link.');
    }
  }

  function toggleSelectAllPending(ids: string[]) {
    if (selectedPendingIds.length === ids.length && ids.length > 0) {
      setSelectedPendingIds([]);
    } else {
      setSelectedPendingIds(ids);
    }
  }

  function toggleSelectPending(id: string) {
    setSelectedPendingIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  async function handleSaveSmtp(e: React.FormEvent) {
    e.preventDefault();
    setSavingSmtp(true);
    try {
      const res = await saveSmtpConfigAction({
        host: smtpForm.host.trim(),
        port: Number(smtpForm.port),
        user: smtpForm.user?.trim() || undefined,
        pass: smtpForm.pass?.trim() || undefined,
        from: smtpForm.from?.trim() || undefined,
      });

      if (res.warning) {
        toast.warning(res.warning);
      } else {
        toast.success(res.message || 'SMTP settings saved and verified!');
      }

      await loadData(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save SMTP settings.');
    } finally {
      setSavingSmtp(false);
    }
  }

  const isConfigured = status?.smtp.userConfigured || (status?.smtp.host && status?.smtp.host !== 'localhost');

  return (
    <div className="space-y-6">
      {/* Friendly Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-slate-900">
                Email System & Employee Invitations
              </h2>
              {/* Live Connection Status Badge */}
              {status?.smtp.connected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  SMTP Connected ({status.smtp.host})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  {isConfigured ? 'Connection Error' : 'Local Dev Mode (Mailpit)'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Configure your outgoing mail server, test delivery to your inbox, and manage employee onboarding invites.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={() => loadData(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition-colors"
            title="Refresh status from server"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {(!status?.smtp.host || status.smtp.host === 'localhost') && (
            <a
              href="http://localhost:8025"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-xl border border-slate-200 transition-colors"
              title="Open local development Mailpit inbox"
            >
              <ExternalLink className="h-3 w-3" />
              <span>Mailpit (8025)</span>
            </a>
          )}
        </div>
      </div>

      {/* Main Grid: SMTP Configuration Form & Live Test Email Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Main Card: Direct SMTP Server Configuration (No Modal, No Auto-Reset!) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Outgoing SMTP Server Settings
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Settings saved directly in database</span>
          </div>

          {/* Quick Preset Buttons */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Quick Provider Presets:
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('gmail')}
                className={`py-2 px-2 text-center rounded-xl text-xs font-semibold border transition-all ${
                  activePreset === 'gmail'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-2xs ring-1 ring-blue-500'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Gmail
              </button>
              <button
                type="button"
                onClick={() => applyPreset('brevo')}
                className={`py-2 px-2 text-center rounded-xl text-xs font-semibold border transition-all ${
                  activePreset === 'brevo'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-2xs ring-1 ring-blue-500'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Brevo
              </button>
              <button
                type="button"
                onClick={() => applyPreset('mailpit')}
                className={`py-2 px-2 text-center rounded-xl text-xs font-semibold border transition-all ${
                  activePreset === 'mailpit'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-2xs ring-1 ring-blue-500'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Mailpit (Dev)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('custom')}
                className={`py-2 px-2 text-center rounded-xl text-xs font-semibold border transition-all ${
                  activePreset === 'custom'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-bold shadow-2xs ring-1 ring-blue-500'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Custom SMTP
              </button>
            </div>
          </div>

          {/* Help notice for Gmail */}
          {activePreset === 'gmail' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                <span>Gmail Setup Instructions:</span>
              </div>
              <p>1. Enter your full Gmail address (e.g. <code>myemail@gmail.com</code>).</p>
              <p>2. In your Google Account (Security &gt; 2-Step Verification &gt; <strong>App passwords</strong>), generate a 16-letter password and paste it into the Password field below.</p>
            </div>
          )}

          {/* Direct Form */}
          <form onSubmit={handleSaveSmtp} className="space-y-3.5 text-xs">
            {/* Host & Port */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">
                  SMTP Host / Server Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. smtp.gmail.com"
                  value={smtpForm.host}
                  onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Port <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  placeholder="465 or 587"
                  value={smtpForm.port}
                  onChange={(e) => setSmtpForm({ ...smtpForm, port: parseInt(e.target.value) || 465 })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Email / Username */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                SMTP Email Address / Username
              </label>
              <input
                type="text"
                placeholder="e.g. you@gmail.com"
                value={smtpForm.user}
                onChange={(e) => setSmtpForm({ ...smtpForm, user: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            {/* Password / App Password with toggle */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">
                  Password / 16-Character App Password
                </label>
                {status?.smtp?.hasSavedPassword && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    <Check className="h-3 w-3 text-emerald-600" /> Saved in Database
                  </span>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={status?.smtp?.hasSavedPassword ? "•••••••••••••••• (Leave blank to keep saved password)" : "e.g. abcd efgh ijkl mnop"}
                  value={smtpForm.pass}
                  onChange={(e) => setSmtpForm({ ...smtpForm, pass: e.target.value })}
                  className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                {status?.smtp?.hasSavedPassword
                  ? 'Your 16-character app password is saved. Leave blank to keep it, or enter a new one to update.'
                  : 'Enter your 16-character Gmail App Password (spaces will be automatically removed).'}
              </span>
            </div>

            {/* From Email Address */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Sender &quot;From&quot; Email Display
              </label>
              <input
                type="text"
                placeholder="OES Notifications <you@gmail.com>"
                value={smtpForm.from}
                onChange={(e) => setSmtpForm({ ...smtpForm, from: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                For Gmail or Brevo, this will automatically match your authenticated email address.
              </span>
            </div>

            {/* Save Button */}
            <div className="pt-2 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                Clicking save will verify credentials immediately.
              </span>

              <button
                type="submit"
                disabled={savingSmtp}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors shadow-xs disabled:opacity-50"
              >
                {savingSmtp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                <span>{savingSmtp ? 'Saving & Verifying SMTP...' : 'Save & Connect SMTP'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right Card: Quick Test Tool & Active Diagnostics */}
        <div className="lg:col-span-5 space-y-5">
          {/* Quick Test Console */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Send className="h-5 w-5 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Real-Time Test Email Dispatch
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Send a test email to verify that your saved server can reach external recipients.
            </p>

            <form onSubmit={handleSendTestEmail} className="space-y-3">
              <input
                type="email"
                required
                placeholder="Enter recipient email (e.g. you@gmail.com)..."
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={sendingTest}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-colors shadow-2xs disabled:opacity-50"
              >
                {sendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span>{sendingTest ? 'Dispatching Test Email...' : 'Send Immediate Test Email'}</span>
              </button>
            </form>

            {testFeedback && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 animate-fade-in ${
                  testFeedback.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {testFeedback.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-bold">
                    {testFeedback.success ? 'Delivered Successfully!' : 'Delivery Failed'}
                  </div>
                  <div className="text-[11px] mt-0.5 break-words">{testFeedback.message}</div>
                  <div className="text-[10px] text-slate-400 mt-1">Checked at {testFeedback.time}</div>
                </div>
              </div>
            )}
          </div>

          {/* Active Server Health Summary Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>Current Status Overview</span>
            </h4>

            <div className="space-y-2 text-xs text-slate-600 pt-1">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Server Host:</span>
                <span className="font-mono font-bold text-slate-900">{status?.smtp.host || 'Not set'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Server Port:</span>
                <span className="font-mono font-bold text-slate-900">{status?.smtp.port || 465}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-400">Sender Account:</span>
                <span className="font-semibold text-slate-900 truncate max-w-[200px]">
                  {status?.smtp.user ? status.smtp.user : 'Anonymous / Local'}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Pending Invites:</span>
                <span className="font-bold text-blue-600">{pendingEmployees.length} employee(s)</span>
              </div>
            </div>

            {status?.smtp.error && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Notice:</strong> {status.smtp.error}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Section: Dual-Tab Registration & Account Management */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveRegTab('pending');
                setRegPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeRegTab === 'pending'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/60 bg-white border border-slate-200'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Pending Invitations</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  activeRegTab === 'pending'
                    ? 'bg-blue-700/80 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {pendingEmployees.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveRegTab('done');
                setRegPage(1);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeRegTab === 'done'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/60 bg-white border border-slate-200'
              }`}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Done Registrations</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  activeRegTab === 'done'
                    ? 'bg-emerald-700/80 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {doneEmployees.length}
              </span>
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${activeRegTab === 'pending' ? 'pending' : 'done'} accounts...`}
              value={regSearchTerm}
              onChange={(e) => {
                setRegSearchTerm(e.target.value);
                setRegPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-2xs"
            />
            {regSearchTerm && (
              <button
                onClick={() => {
                  setRegSearchTerm('');
                  setRegPage(1);
                }}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Multi-Select Sticky Bar for Pending Tab */}
        {activeRegTab === 'pending' && selectedPendingIds.length > 0 && (
          <div className="flex items-center justify-between bg-blue-50/95 border-b border-blue-200 px-5 py-3 text-xs animate-fade-in">
            <div className="flex items-center gap-2 text-blue-900 font-semibold">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-[10px] font-bold">
                {selectedPendingIds.length}
              </span>
              <span>employee(s) selected for bulk activation invite</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedPendingIds([])}
                className="px-2.5 py-1 rounded-lg border border-slate-300 text-slate-600 hover:bg-white text-xs font-medium"
              >
                Clear Selection
              </button>
              <button
                onClick={handleSendBulkInvites}
                disabled={bulkSendingInvites}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-2xs"
              >
                {bulkSendingInvites ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Mail className="h-3.5 w-3.5" />
                )}
                <span>{bulkSendingInvites ? 'Dispatching Invitations...' : `Send Invitations to Selected (${selectedPendingIds.length})`}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 1 Content: Pending Account Invitations */}
        {activeRegTab === 'pending' && (
          <div className="overflow-x-auto">
            {(() => {
              const filtered = pendingEmployees.filter((e) => {
                if (!regSearchTerm.trim()) return true;
                const q = regSearchTerm.toLowerCase();
                return (
                  e.fullName.toLowerCase().includes(q) ||
                  e.email.toLowerCase().includes(q) ||
                  e.employeeCode.toLowerCase().includes(q) ||
                  (e.department && e.department.toLowerCase().includes(q))
                );
              });

              const totalPages = Math.ceil(filtered.length / regPageSize) || 1;
              const paginated = filtered.slice((regPage - 1) * regPageSize, regPage * regPageSize);

              return (
                <>
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50/90 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200 tracking-wider">
                      <tr>
                        <th className="px-4 py-3.5 w-10">
                          <input
                            type="checkbox"
                            checked={
                              filtered.length > 0 && selectedPendingIds.length === filtered.length
                            }
                            onChange={() => toggleSelectAllPending(filtered.map((p) => p.id))}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                          />
                        </th>
                        <th className="px-4 py-3.5 font-sans">Employee</th>
                        <th className="px-4 py-3.5 font-sans">Email Address</th>
                        <th className="px-4 py-3.5 font-sans">Department & Shift</th>
                        <th className="px-4 py-3.5 font-sans">Invitation Status</th>
                        <th className="px-4 py-3.5 text-right font-sans">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                            <span className="font-semibold block text-slate-700">No Pending Invitations</span>
                            <span className="text-xs text-slate-400">
                              {regSearchTerm
                                ? 'No employees match your search query.'
                                : 'All employees have completed their registrations and activated their accounts!'}
                            </span>
                          </td>
                        </tr>
                      ) : (
                        paginated.map((emp) => {
                          const isSelected = selectedPendingIds.includes(emp.id);
                          return (
                            <tr
                              key={emp.id}
                              className={`hover:bg-slate-50/70 transition-colors ${
                                isSelected ? 'bg-blue-50/30' : ''
                              }`}
                            >
                              {/* Selection Checkbox */}
                              <td className="px-4 py-3.5">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelectPending(emp.id)}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                                />
                              </td>

                              {/* Employee Details */}
                              <td className="px-4 py-3.5 font-sans">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900">{emp.fullName}</span>
                                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 font-mono">
                                    {emp.employeeCode}
                                  </span>
                                </div>
                              </td>

                              {/* Email */}
                              <td className="px-4 py-3.5 font-mono text-[11px] text-slate-700">
                                {emp.email}
                              </td>

                              {/* Department & Shift */}
                              <td className="px-4 py-3.5 text-slate-600 text-[11px]">
                                <div className="font-medium text-slate-800">{emp.department}</div>
                                <div className="text-slate-400 text-[10px]">{emp.shiftName}</div>
                              </td>

                              {/* Invitation Status */}
                              <td className="px-4 py-3.5">
                                {emp.invitationStatus === 'SENT' ? (
                                  <div className="space-y-0.5">
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                      <CheckCircle2 className="h-3 w-3 text-blue-600" />
                                      INVITE SENT
                                    </span>
                                    {emp.tokenExpiresAt && (
                                      <div className="text-[10px] text-slate-400 font-mono">
                                        Expires: {new Date(emp.tokenExpiresAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                    <Clock className="h-3 w-3 text-amber-600" />
                                    NOT SENT
                                  </span>
                                )}
                              </td>

                              {/* Action Buttons */}
                              <td className="px-4 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Copy Link Button */}
                                  <button
                                    onClick={() => handleCopyActivationLink(emp.tokenId, emp.email, emp.tokenValue)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-2xs"
                                    title="Copy direct activation URL"
                                  >
                                    {copiedId === (emp.tokenId || emp.email) ? (
                                      <>
                                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                                        <span className="text-emerald-700">Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="h-3.5 w-3.5 text-slate-500" />
                                        <span>Copy Link</span>
                                      </>
                                    )}
                                  </button>

                                  {/* Send / Resend Email Button */}
                                  <button
                                    onClick={() => handleSendSingleInvite(emp.id, emp.email)}
                                    disabled={sendingInviteId === emp.id}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-2xs disabled:opacity-50 transition-colors ${
                                      emp.invitationStatus === 'SENT'
                                        ? 'bg-slate-700 hover:bg-slate-800 text-white'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                    }`}
                                  >
                                    {sendingInviteId === emp.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Send className="h-3.5 w-3.5" />
                                    )}
                                    <span>{sendingInviteId === emp.id ? 'Sending...' : emp.invitationStatus === 'SENT' ? 'Resend' : 'Send Invite'}</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>

                  {filtered.length > 0 && (
                    <Pagination
                      currentPage={regPage}
                      totalPages={totalPages}
                      totalRecords={filtered.length}
                      pageSize={regPageSize}
                      onPageChange={setRegPage}
                      onPageSizeChange={(s) => {
                        setRegPageSize(s);
                        setRegPage(1);
                      }}
                    />
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Tab 2 Content: Done / Activated Employee Accounts */}
        {activeRegTab === 'done' && (
          <div className="overflow-x-auto">
            {(() => {
              const filtered = doneEmployees.filter((e) => {
                if (!regSearchTerm.trim()) return true;
                const q = regSearchTerm.toLowerCase();
                return (
                  e.fullName.toLowerCase().includes(q) ||
                  e.email.toLowerCase().includes(q) ||
                  e.employeeCode.toLowerCase().includes(q) ||
                  (e.department && e.department.toLowerCase().includes(q))
                );
              });

              const totalPages = Math.ceil(filtered.length / regPageSize) || 1;
              const paginated = filtered.slice((regPage - 1) * regPageSize, regPage * regPageSize);

              return (
                <>
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-50/90 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200 tracking-wider">
                      <tr>
                        <th className="px-5 py-3.5 font-sans">Employee</th>
                        <th className="px-5 py-3.5 font-sans">Email Address</th>
                        <th className="px-5 py-3.5 font-sans">Department</th>
                        <th className="px-5 py-3.5 font-sans">Assigned Shift</th>
                        <th className="px-5 py-3.5 font-sans">Account Status</th>
                        <th className="px-5 py-3.5 text-right font-sans">Joined / Active Since</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                            <Users className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                            <span className="font-semibold block text-slate-700">No Activated Employees Found</span>
                            <span className="text-xs text-slate-400">
                              {regSearchTerm
                                ? 'No activated employees match your search query.'
                                : 'When employees set their password through the invite link, they will appear here.'}
                            </span>
                          </td>
                        </tr>
                      ) : (
                        paginated.map((emp) => (
                          <tr key={emp.id} className="hover:bg-slate-50/70 transition-colors">
                            {/* Employee Details */}
                            <td className="px-5 py-3.5 font-sans">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900">{emp.fullName}</span>
                                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 font-mono">
                                  {emp.employeeCode}
                                </span>
                              </div>
                            </td>

                            {/* Email */}
                            <td className="px-5 py-3.5 font-mono text-[11px] text-slate-700">
                              {emp.email}
                            </td>

                            {/* Department */}
                            <td className="px-5 py-3.5 text-slate-800 font-medium">
                              {emp.department}
                            </td>

                            {/* Shift */}
                            <td className="px-5 py-3.5 text-slate-600">
                              {emp.shiftName}
                            </td>

                            {/* Status */}
                            <td className="px-5 py-3.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                ACTIVE & REGISTERED
                              </span>
                            </td>

                            {/* Joined / Registered */}
                            <td className="px-5 py-3.5 text-right font-mono text-[11px] text-slate-500">
                              {emp.dateJoined || new Date(emp.updatedAt).toLocaleDateString('en-IN')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {filtered.length > 0 && (
                    <Pagination
                      currentPage={regPage}
                      totalPages={totalPages}
                      totalRecords={filtered.length}
                      pageSize={regPageSize}
                      onPageChange={setRegPage}
                      onPageSizeChange={(s) => {
                        setRegPageSize(s);
                        setRegPage(1);
                      }}
                    />
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
