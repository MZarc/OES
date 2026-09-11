'use client';

import { useState, useEffect } from 'react';
import { approveOTAction, rejectOTAction, undoOTAction, getAdminOTPaginatedAction } from '@/app/actions/ot';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import {
  Check,
  X,
  Info,
  Search,
  Filter,
  AlertCircle,
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  ArrowUpDown,
} from 'lucide-react';
import { formatCurrency, formatDateDisplay, formatDateTimeDisplay } from '@/lib/utils';

interface OTRecordItem {
  id: string;
  workDate: string;
  startTime: string;
  endTime: string;
  rawHours: number;
  multiplier: number;
  payableHours: number;
  isSunday: boolean;
  isHoliday: boolean;
  holidayName?: string | null;
  status: string;
  submittedAt: Date | string;
  reviewedAt?: Date | string | null;
  snapshot: string;
  rejectionReason?: string | null;
  employeeName: string;
  employeeCode: string;
  department: string | null;
  shiftName: string;
}

interface PendingOTTableProps {
  initialRecords?: OTRecordItem[];
  records?: OTRecordItem[];
}

import { useToast } from '@/components/ui/Toast';
import { CustomSelect } from '@/components/ui/CustomSelect';

export function PendingOTTable({ initialRecords, records }: PendingOTTableProps) {
  const toast = useToast();
  const defaultItems = initialRecords || records || [];
  const [items, setItems] = useState<OTRecordItem[]>(defaultItems);
  const [total, setTotal] = useState(defaultItems.length);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('SUBMITTED');
  const [sortBy, setSortBy] = useState('submittedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<any | null>(null);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function fetchPage(
    page: number,
    size: number,
    status: string,
    search: string,
    by = sortBy,
    order = sortOrder
  ) {
    setLoading(true);
    try {
      const res = await getAdminOTPaginatedAction({
        page,
        limit: size,
        status,
        search,
        sortBy: by,
        sortOrder: order,
      });
      setItems(res.records as any);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setCurrentPage(res.page);
    } catch (err: any) {
      toast.error(err.message || 'Error fetching OT records.');
    } finally {
      setLoading(false);
    }
  }

  // Reload data whenever page, size, status, search, or sort changes
  useEffect(() => {
    fetchPage(currentPage, pageSize, statusFilter, searchTerm, sortBy, sortOrder);
  }, [currentPage, pageSize, statusFilter, searchTerm, sortBy, sortOrder]);

  async function handleApprove(id: string) {
    setProcessingId(id);
    try {
      await approveOTAction(id);
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: 'APPROVED' } : i))
      );
      toast.success('Overtime record approved successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve OT record.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleConfirmReject() {
    if (!rejectingId || !rejectReason.trim()) return;
    setProcessingId(rejectingId);
    try {
      await rejectOTAction(rejectingId, rejectReason);
      setItems((prev) =>
        prev.map((i) =>
          i.id === rejectingId
            ? { ...i, status: 'REJECTED', rejectionReason: rejectReason }
            : i
        )
      );
      toast.success('Overtime record rejected with recorded reason.');
      setRejectingId(null);
      setRejectReason('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject OT record.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleUndo(id: string) {
    setProcessingId(id);
    try {
      await undoOTAction(id);
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, status: 'SUBMITTED', rejectionReason: null, reviewedAt: null }
            : i
        )
      );
      toast.success('Action undone. Record returned to pending queue.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to undo action.');
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by employee name or code..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50/50"
          />
          {searchTerm && (
            <button
              onClick={() => {
                setSearchTerm('');
                setCurrentPage(1);
              }}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-full hover:bg-slate-200/60"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-medium text-slate-500 hidden sm:inline">Sort:</span>
            <CustomSelect
              size="sm"
              value={`${sortBy}_${sortOrder}`}
              onChange={(val) => {
                const [b, o] = val.split('_');
                setSortBy(b);
                setSortOrder(o as 'asc' | 'desc');
                setCurrentPage(1);
              }}
              options={[
                { value: 'submittedAt_desc', label: 'Submitted (Newest)' },
                { value: 'submittedAt_asc', label: 'Submitted (Oldest)' },
                { value: 'workDate_desc', label: 'Work Date (Newest)' },
                { value: 'workDate_asc', label: 'Work Date (Oldest)' },
                { value: 'payableHours_desc', label: 'Hours (High to Low)' },
                { value: 'payableHours_asc', label: 'Hours (Low to High)' },
                { value: 'fullName_asc', label: 'Employee (A - Z)' },
              ]}
            />
          </div>

          <div className="flex items-center gap-1.5">
            {['SUBMITTED', 'APPROVED', 'REJECTED', 'ALL'].map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st === 'SUBMITTED' ? 'Pending Review' : st === 'ALL' ? 'All Records' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <TableSkeleton columns={7} rows={6} />
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Clock className="h-9 w-9 text-slate-300 mx-auto mb-2" />
            No overtime records found matching the current search and filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Employee</th>
                  <th className="px-4 py-3.5">Work Date</th>
                  <th className="px-4 py-3.5">Interval</th>
                  <th className="px-4 py-3.5">Duration</th>
                  <th className="px-4 py-3.5">Rate</th>
                  <th className="px-4 py-3.5 font-bold text-slate-900">Payable OT</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((r) => {
                  let snapObj = null;
                  try {
                    snapObj = JSON.parse(r.snapshot);
                  } catch (e) {}

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">{r.employeeName}</div>
                        <div className="text-[11px] text-slate-500">
                          {r.employeeCode} • {r.department || 'General'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-800">{formatDateDisplay(r.workDate)}</div>
                        <div className="text-[11px] text-slate-400">{r.shiftName}</div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-600">
                        {r.startTime} → {r.endTime}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-slate-600">
                        {r.rawHours.toFixed(2)}h
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {r.multiplier.toFixed(2)}×
                          {r.isSunday && <span className="text-amber-600 font-bold ml-1">Sun</span>}
                          {r.isHoliday && <span className="text-emerald-600 font-bold ml-1">Hol</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-blue-600 font-mono text-sm">
                        {r.payableHours.toFixed(2)}h
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            r.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : r.status === 'REJECTED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {r.status === 'APPROVED' && <CheckCircle2 className="h-3 w-3" />}
                          {r.status === 'REJECTED' && <XCircle className="h-3 w-3" />}
                          {r.status === 'SUBMITTED' && <Clock className="h-3 w-3" />}
                          {r.status}
                        </span>

                        {/* Created and Reviewed Timestamps */}
                        <div className="text-[10px] text-slate-400 mt-1 space-y-0.5 whitespace-nowrap">
                          <div>
                            <span className="text-slate-500 font-medium">Created:</span>{' '}
                            {formatDateTimeDisplay(r.submittedAt)}
                          </div>
                          {r.reviewedAt && (
                            <div className="text-emerald-700 font-medium">
                              <span>Approved:</span> {formatDateTimeDisplay(r.reviewedAt)}
                            </div>
                          )}
                        </div>

                        {r.rejectionReason && (
                          <div
                            className="text-[10px] text-rose-600 mt-0.5 max-w-xs truncate font-medium"
                            title={r.rejectionReason}
                          >
                            Reason: {r.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Transparency Breakdown Button */}
                          <button
                            onClick={() => setSelectedSnapshot(snapObj)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="View Calculation Trace"
                          >
                            <Info className="h-4 w-4" />
                          </button>

                          {r.status === 'SUBMITTED' && (
                            <>
                              <button
                                onClick={() => handleApprove(r.id)}
                                disabled={processingId === r.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 shadow-2xs"
                              >
                                {processingId === r.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Check className="h-3.5 w-3.5" />
                                )}
                                Approve
                              </button>

                              <button
                                onClick={() => {
                                  setRejectingId(r.id);
                                  setRejectReason('');
                                }}
                                disabled={processingId === r.id}
                                className="inline-flex items-center gap-1 px-2 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-100 disabled:opacity-50"
                              >
                                <X className="h-3.5 w-3.5" />
                                Reject
                              </button>
                            </>
                          )}

                          {(r.status === 'APPROVED' || r.status === 'REJECTED') && (
                            <button
                              onClick={() => handleUndo(r.id)}
                              disabled={processingId === r.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold hover:bg-amber-100 disabled:opacity-50 transition-colors shadow-2xs"
                              title="Revert back to Pending status"
                            >
                              {processingId === r.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5 text-amber-700" />
                              )}
                              Undo
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalRecords={total}
          pageSize={pageSize}
          onPageChange={(p) => setCurrentPage(p)}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Mandatory Rejection Reason Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
          <div className="relative my-auto bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-slide-up">
            <h3 className="text-base font-bold text-slate-900">Reject Overtime Submission</h3>
            <p className="text-xs text-slate-500">
              A rejection reason is mandatory. The employee will receive this feedback in their portal.
            </p>
            <textarea
              required
              rows={3}
              placeholder="e.g. Discrepancy in actual work hours logged; regular shift not completed."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full border border-slate-300 rounded-xl p-3 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setRejectingId(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={!rejectReason.trim() || processingId === rejectingId}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 disabled:opacity-50 shadow-xs transition-colors"
              >
                {processingId === rejectingId ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <span>Confirm Rejection</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calculation Transparency Trace Modal */}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
          <div className="relative my-auto bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Immutable Calculation Trace</h3>
              </div>
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="font-semibold text-slate-400 text-[10px] uppercase block">Shift</span>
                  <span className="font-bold text-slate-800">{selectedSnapshot.shiftName}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400 text-[10px] uppercase block">Scheduled</span>
                  <span className="font-bold text-slate-800">
                    {selectedSnapshot.scheduledStart} – {selectedSnapshot.scheduledEnd}
                  </span>
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-slate-400 text-[10px] uppercase block">OT Boundary</span>
                  <span className="font-bold text-slate-800">{selectedSnapshot.otBoundary}</span>
                </div>
                <div className="mt-1">
                  <span className="font-semibold text-slate-400 text-[10px] uppercase block">Submitted</span>
                  <span className="font-bold text-slate-800">
                    {selectedSnapshot.startTime} – {selectedSnapshot.endTime}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center p-3 bg-blue-50/80 rounded-xl border border-blue-100">
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Raw Duration</div>
                  <div className="text-sm font-bold text-slate-900">
                    {selectedSnapshot.rawHours?.toFixed(2)}h
                  </div>
                  <div className="text-[10px] text-slate-400">
                    ({selectedSnapshot.rawDurationMinutes} min)
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Multiplier</div>
                  <div className="text-sm font-bold text-blue-700">
                    {selectedSnapshot.multiplier?.toFixed(2)}×
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {selectedSnapshot.isSunday
                      ? 'Sunday'
                      : selectedSnapshot.isHoliday
                      ? selectedSnapshot.holidayName || 'Holiday'
                      : 'Standard'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Payable OT</div>
                  <div className="text-base font-extrabold text-blue-800">
                    {selectedSnapshot.payableHours?.toFixed(2)}h
                  </div>
                </div>
              </div>

              <div className="text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-100">
                Rule Version: {selectedSnapshot.ruleVersion} • Shift Version: {selectedSnapshot.shiftVersion}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedSnapshot(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Close Trace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
