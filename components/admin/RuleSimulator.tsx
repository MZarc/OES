'use client';

import { useState } from 'react';
import { simulateOTCalculationAction } from '@/app/actions/rules';
import { Play, RotateCcw, CheckCircle, AlertTriangle, Sparkles, Sliders, Info, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { CustomSelect } from '@/components/ui/CustomSelect';

interface ShiftOption {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  regularOtStartTime: string;
}

export function RuleSimulator({ shifts }: { shifts: ShiftOption[] }) {
  const today = new Date().toISOString().split('T')[0];

  const [workDate, setWorkDate] = useState(today);
  const [selectedShiftId, setSelectedShiftId] = useState(shifts[0]?.id || '');
  const [startTime, setStartTime] = useState(shifts[0]?.startTime || '07:00');
  const [endTime, setEndTime] = useState('19:00');
  const [roundingPolicy, setRoundingPolicy] = useState('UP_TO_NEXT_1_HOUR');
  const [sundayMultiplier, setSundayMultiplier] = useState(1.25);
  const [holidayMultiplier, setHolidayMultiplier] = useState(1.25);

  const [simulating, setSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleShiftChange(shiftId: string) {
    setSelectedShiftId(shiftId);
    const s = shifts.find((x) => x.id === shiftId);
    if (s) {
      setStartTime(s.startTime);
    }
  }

  async function handleSimulate(e: React.FormEvent) {
    e.preventDefault();
    setSimulating(true);
    setError(null);
    try {
      const res = await simulateOTCalculationAction({
        workDate,
        startTime,
        endTime,
        shiftId: selectedShiftId,
        roundingPolicy,
        sundayMultiplier,
        holidayMultiplier,
      });
      setSimulationResult(res);
    } catch (err: any) {
      setError(err.message || 'Simulation error');
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Simulation Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <Sliders className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900">OT Policy Simulator & Sandbox</h2>
            <p className="text-xs text-slate-500">
              Simulate edge-case calculations without touching live data.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSimulate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date to Simulate
              </label>
              <input
                type="date"
                required
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Shift
              </label>
              <CustomSelect
                size="sm"
                className="w-full"
                value={selectedShiftId}
                onChange={(val) => handleShiftChange(val)}
                options={shifts.map((s) => ({
                  value: s.id,
                  label: `${s.name} (${s.startTime}–${s.endTime})`,
                }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Simulated Start Time
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Simulated End Time
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Policy Overrides */}
          <div className="border-t pt-3 space-y-3">
            <span className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
              Rule Parameter Overrides
            </span>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-slate-600 mb-1">Rounding Policy</label>
                <CustomSelect
                  size="sm"
                  className="w-full"
                  value={roundingPolicy}
                  onChange={(val) => setRoundingPolicy(val)}
                  options={[
                    { value: 'EXACT', label: 'EXACT' },
                    { value: 'UP_TO_NEXT_15_MINUTES', label: 'UP_TO_NEXT_15_MINUTES' },
                    { value: 'UP_TO_NEXT_30_MINUTES', label: 'UP_TO_NEXT_30_MINUTES' },
                    { value: 'UP_TO_NEXT_1_HOUR', label: 'UP_TO_NEXT_1_HOUR' },
                    { value: 'NEAREST_30_MINUTES', label: 'NEAREST_30_MINUTES' },
                  ]}
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-1">Sunday Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  value={sundayMultiplier}
                  onChange={(e) => setSundayMultiplier(parseFloat(e.target.value))}
                  className="w-full text-xs rounded border border-slate-300 p-1.5"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-600 mb-1">Holiday Multiplier</label>
                <input
                  type="number"
                  step="0.05"
                  value={holidayMultiplier}
                  onChange={(e) => setHolidayMultiplier(parseFloat(e.target.value))}
                  className="w-full text-xs rounded border border-slate-300 p-1.5"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={simulating}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg p-2.5 text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {simulating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Simulating Policy...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                <span>Execute Policy Simulation</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Simulation Result Screen */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-2">Authoritative Calculation Result</h3>
        <p className="text-xs text-slate-500 mb-4">
          Generated deterministically by pure domain engine.
        </p>

        {simulationResult ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500">Raw Duration</div>
                <div className="text-lg font-bold text-slate-900 font-mono">
                  {simulationResult.rawHours.toFixed(2)}h
                </div>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200">
                <div className="text-[11px] text-slate-500">Multiplier</div>
                <div className="text-lg font-bold text-blue-600 font-mono">
                  {simulationResult.multiplier.toFixed(2)}×
                </div>
              </div>

              <div className="bg-blue-600 text-white p-3 rounded-lg shadow-sm">
                <div className="text-[11px] text-blue-100">Payable OT</div>
                <div className="text-xl font-extrabold font-mono">
                  {simulationResult.payableHours.toFixed(2)}h
                </div>
              </div>
            </div>

            {/* Explanation Trace */}
            <div className="bg-white p-4 rounded-lg border border-slate-200 text-xs text-slate-700 space-y-2">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Info className="h-4 w-4 text-blue-600" />
                Audit Explanation:
              </div>
              <p className="text-slate-600 leading-relaxed font-mono text-[11px]">
                {simulationResult.explanation}
              </p>
            </div>

            <div className="bg-white p-3 rounded-lg border border-slate-200 text-[11px] text-slate-500 space-y-1 font-mono">
              <div>Work Date: {simulationResult.snapshot.workDate}</div>
              <div>Shift Boundary: {simulationResult.snapshot.otBoundary}</div>
              <div>Day Type: {simulationResult.isSunday ? 'Sunday' : simulationResult.isHoliday ? 'Holiday' : 'Regular'}</div>
              <div>Rounding Policy: {simulationResult.snapshot.roundingPolicy}</div>
            </div>
          </div>
        ) : (
          <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-center">
            <Sliders className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-xs">Select parameters and click Execute Policy Simulation.</p>
          </div>
        )}
      </div>
    </div>
  );
}
