'use client';

import { useState, useEffect } from 'react';
import { calculateOTPreviewAction, submitOTAction } from '@/app/actions/ot';
import { Clock, Info, CheckCircle2, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { CustomSelect } from '@/components/ui/CustomSelect';

interface ShiftOption {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  regularOtStartTime: string;
}

interface OTFormProps {
  availableShifts?: ShiftOption[];
  defaultShiftId?: string;
}

export function OTForm({ availableShifts = [], defaultShiftId = 'auto' }: OTFormProps) {
  const router = useRouter();
  const toast = useToast();
  const today = new Date().toISOString().split('T')[0];

  const [workDate, setWorkDate] = useState(today);
  const [startTime, setStartTime] = useState('08:30');
  const [endTime, setEndTime] = useState('20:30');
  const [selectedShiftId, setSelectedShiftId] = useState<string>(defaultShiftId);
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [preview, setPreview] = useState<{
    rawHours: number;
    payableHours: number;
    multiplier: number;
    isSunday: boolean;
    isHoliday: boolean;
    holidayName?: string;
    explanation: string;
    detectedShift?: {
      id: string;
      name: string;
      code: string;
      startTime: string;
      endTime: string;
      regularOtStartTime: string;
    };
  } | null>(null);

  // Run live calculation whenever date, start time, end time or shift selection changes
  useEffect(() => {
    let active = true;

    async function fetchPreview() {
      if (!workDate || !startTime || !endTime) return;
      setCalculating(true);
      try {
        const res = await calculateOTPreviewAction({
          workDate,
          startTime,
          endTime,
          shiftId: selectedShiftId === 'auto' ? undefined : selectedShiftId,
        });
        if (active) {
          setPreview(res as any);
        }
      } catch (err: any) {
        console.error('Preview error:', err);
      } finally {
        if (active) setCalculating(false);
      }
    }

    const timer = setTimeout(fetchPreview, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [workDate, startTime, endTime, selectedShiftId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await submitOTAction({
        workDate,
        startTime,
        endTime,
        shiftId: selectedShiftId === 'auto' ? undefined : selectedShiftId,
      });

      if (res.success) {
        toast.success(`OT submitted successfully! Calculated ${res.payableHours.toFixed(2)} payable hours.`);
        setTimeout(() => {
          router.push('/dashboard');
        }, 1200);
      } else {
        setSubmitting(false);
      }
    } catch (err: any) {
      if (err.message?.includes('UNAUTHORIZED')) {
        toast.error('Session expired or not logged in. Redirecting to login...');
        setTimeout(() => {
          router.push('/login');
        }, 1500);
      } else {
        toast.error(err.message || 'Failed to submit OT. Please check inputs.');
        setSubmitting(false);
      }
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-xl mx-auto">
      <div className="flex items-center justify-between gap-2 mb-6 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2.5">
          <Clock className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-lg font-bold text-slate-900">Log Overtime</h2>
            <p className="text-xs text-slate-500">
              Shift is non-mandatory — auto-determined by your working hours.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Date Input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Work Date
          </label>
          <input
            type="date"
            required
            value={workDate}
            onChange={(e) => setWorkDate(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Start & End Times */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Start Time
            </label>
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              End Time
            </label>
            <input
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Shift Selection (Non-mandatory, defaults to Auto-detect) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-slate-700">
              Shift Policy <span className="text-xs font-normal text-slate-400">(Optional / Flexible)</span>
            </label>
            {selectedShiftId === 'auto' && preview?.detectedShift && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                <Sparkles className="h-3 w-3 text-blue-600" />
                Detected: {preview.detectedShift.name}
              </span>
            )}
          </div>
          <CustomSelect
            size="md"
            className="w-full"
            value={selectedShiftId}
            onChange={(val) => setSelectedShiftId(val)}
            options={[
              { value: 'auto', label: '⚡ Auto-detect based on timing (Non-mandatory)' },
              ...availableShifts.map((s) => ({
                value: s.id,
                label: `${s.name} (${s.startTime} – ${s.endTime}, OT starts after ${s.regularOtStartTime})`,
              })),
            ]}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            You do not need to lock a shift. e.g. <strong>07:00 → 19:00</strong> counts <strong>4 hrs OT</strong> (First Shift), and <strong>08:30 → 20:30</strong> counts <strong>3 hrs OT</strong> (General Shift).
          </p>
        </div>

        {/* Dynamic Shift Badge when Auto-detect is active */}
        {preview?.detectedShift && (
          <div className="flex items-center gap-2 rounded-lg bg-indigo-50/70 border border-indigo-100 p-2.5 text-xs text-indigo-900">
            <Sparkles className="h-4 w-4 text-indigo-600 flex-shrink-0" />
            <div>
              <span className="font-semibold">{preview.detectedShift.name}</span>
              <span className="text-indigo-600 ml-1">
                ({preview.detectedShift.startTime} – {preview.detectedShift.endTime})
              </span>
              <span className="text-slate-600 ml-2">
                • Regular OT begins after <strong>{preview.detectedShift.regularOtStartTime}</strong>
              </span>
            </div>
          </div>
        )}

        {/* Live Calculation Transparency Breakdown */}
        {preview && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Instant Calculation Preview
              </span>
              {calculating && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white p-2.5 rounded border border-slate-200">
                <div className="text-xs text-slate-500">Raw OT</div>
                <div className="text-lg font-bold text-slate-800">
                  {preview.rawHours.toFixed(2)}h
                </div>
              </div>

              <div className="bg-white p-2.5 rounded border border-slate-200">
                <div className="text-xs text-slate-500">Multiplier</div>
                <div className="text-lg font-bold text-blue-600">
                  {preview.multiplier.toFixed(2)}×
                </div>
                {preview.isSunday && (
                  <span className="text-[10px] text-amber-600 font-medium">Sunday</span>
                )}
                {preview.isHoliday && (
                  <span className="text-[10px] text-emerald-600 font-medium block">
                    {preview.holidayName || 'Holiday'}
                  </span>
                )}
              </div>

              <div className="bg-blue-600 text-white p-2.5 rounded shadow-sm">
                <div className="text-xs text-blue-100">Payable OT</div>
                <div className="text-xl font-extrabold">
                  {preview.payableHours.toFixed(2)}h
                </div>
              </div>
            </div>

            {/* Explanation Trace */}
            <div className="flex items-start gap-2 pt-2 text-xs text-slate-600 border-t border-slate-200">
              <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <span>{preview.explanation}</span>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || calculating}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Submitting OT for Review...</span>
            </>
          ) : (
            'Submit OT for Review'
          )}
        </button>
      </form>
    </div>
  );
}
