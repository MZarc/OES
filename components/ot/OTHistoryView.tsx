'use client';

import { useState, useEffect, useTransition } from 'react';
import { getMyOTRecordsPaginatedAction, deleteMyOTAction } from '@/app/actions/ot';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { formatDateDisplay, formatDateTimeDisplay } from '@/lib/utils';
import {
  Clock,
  Info,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Sparkles,
  X,
  ChevronDown,
  ChevronUp,
  Trash2,
  Loader2,
  Search,
  ArrowUpDown,
} from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/components/ui/Toast';
import { CustomSelect } from '@/components/ui/CustomSelect';

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
  rejectionReason?: string | null;
  calculationSnapshot?: string | null;
}

export function OTHistoryView() {
  const toast = useToast();
  const [records, setRecords] = useState<OTRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('submittedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [activeTrace, setActiveTrace] = useState<any | null>(null);
  const [expandedMobileId, setExpandedMobileId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  async function loadData(page: number, size: number, status: string, search: string, by = sortBy, order = sortOrder) {
    setLoading(true);
    try {
      const res = await getMyOTRecordsPaginatedAction({
        page,
        limit: size,
        status,
        search,
        sortBy: by,
        sortOrder: order,
      });
      setRecords(res.records as any);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setCurrentPage(res.page);
    } catch (err) {
      console.error('Failed to load OT history:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(currentPage, pageSize, statusFilter, searchTerm, sortBy, sortOrder);
  }, [currentPage, pageSize, statusFilter, searchTerm, sortBy, sortOrder]);

  function handleStatusChange(newStatus: string) {
    setStatusFilter(newStatus);
    setCurrentPage(1);
  }

  async function handleDeleteOT(id: string) {
    setDeletingLoading(true);
    try {
      await deleteMyOTAction(id);
      toast.success('Overtime record deleted successfully.');
      setDeletingId(null);
      loadData(currentPage, pageSize, statusFilter, searchTerm, sortBy, sortOrder);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete record.');
    } finally {
      setDeletingLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search work date, holiday..."
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

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto justify-between sm:justify-end">
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
              ]}
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {['ALL', 'SUBMITTED', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => handleStatusChange(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st === 'ALL' ? 'All Records' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <TableSkeleton columns={6} rows={6} />
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <Clock className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-800">No overtime records found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {statusFilter !== 'ALL'
              ? `No records matching status "${statusFilter}". Try switching filters.`
              : 'You have not submitted any overtime entries yet.'}
          </p>
          <div className="mt-4">
            <Link
              href="/ot/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-sm"
            >
              Log Overtime Now
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Work Date</th>
                  <th className="px-5 py-3.5">Interval</th>
                  <th className="px-5 py-3.5">Raw Duration</th>
                  <th className="px-5 py-3.5">Rate Multiplier</th>
                  <th className="px-5 py-3.5 font-bold text-slate-900">Payable OT</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{formatDateDisplay(r.workDate)}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-600">
                      {r.startTime} → {r.endTime}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-600">{r.rawHours.toFixed(2)}h</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {r.multiplier.toFixed(2)}×
                        {r.isSunday && <span className="text-amber-600">Sun</span>}
                        {r.isHoliday && <span className="text-emerald-600">Hol</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-blue-600 text-sm font-mono">
                      {r.payableHours.toFixed(2)}h
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          r.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : r.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {r.status === 'APPROVED' && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                        {r.status === 'REJECTED' && <XCircle className="h-3 w-3 text-rose-600" />}
                        {r.status === 'SUBMITTED' && <Clock className="h-3 w-3 text-blue-600" />}
                        {r.status}
                      </span>

                      {/* Timestamps */}
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
                        <div className="text-[10px] text-rose-600 mt-1 max-w-xs truncate">
                          Reason: {r.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        {r.calculationSnapshot && (
                          <button
                            onClick={() => {
                              try {
                                setActiveTrace(JSON.parse(r.calculationSnapshot as string));
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50"
                          >
                            <Info className="h-3.5 w-3.5" />
                            Trace
                          </button>
                        )}

                        {r.status !== 'APPROVED' && (
                          <button
                            onClick={() => setDeletingId(r.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete My OT Entry"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Touch-Friendly Card View */}
          <div className="md:hidden divide-y divide-slate-100">
            {records.map((r) => {
              const isExpanded = expandedMobileId === r.id;
              return (
                <div key={`m-${r.id}`} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-sm">{formatDateDisplay(r.workDate)}</span>
                      <div className="text-xs text-slate-500 font-mono">
                        {r.startTime} – {r.endTime}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-bold text-blue-600 font-mono">
                        {r.payableHours.toFixed(2)}h
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          r.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : r.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {r.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-50">
                    <span>
                      Multiplier: <strong>{r.multiplier.toFixed(2)}×</strong>
                    </span>
                    <button
                      onClick={() => setExpandedMobileId(isExpanded ? null : r.id)}
                      className="inline-flex items-center gap-1 text-slate-600 text-xs font-medium"
                    >
                      {isExpanded ? 'Less' : 'More info'}
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1.5 animate-slide-up">
                      <div>
                        Raw Duration: <strong>{r.rawHours.toFixed(2)}h</strong>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Created: {formatDateTimeDisplay(r.submittedAt)}
                      </div>
                      {r.reviewedAt && (
                        <div className="text-[11px] text-emerald-700 font-medium">
                          Approved: {formatDateTimeDisplay(r.reviewedAt)}
                        </div>
                      )}
                      {r.rejectionReason && (
                        <div className="text-rose-700 font-medium">Rejection Reason: {r.rejectionReason}</div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        {r.calculationSnapshot && (
                          <button
                            onClick={() => {
                              try {
                                setActiveTrace(JSON.parse(r.calculationSnapshot as string));
                              } catch (e) {
                                console.error(e);
                              }
                            }}
                            className="text-blue-600 font-semibold inline-flex items-center gap-1 text-xs"
                          >
                            <Info className="h-3 w-3" />
                            Trace
                          </button>
                        )}
                        {r.status !== 'APPROVED' && (
                          <button
                            onClick={() => setDeletingId(r.id)}
                            className="text-rose-600 font-semibold inline-flex items-center gap-1 text-xs ml-auto"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
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
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-3 animate-slide-up">
            <div className="flex items-center gap-2.5 text-rose-600 font-bold text-sm">
              <Trash2 className="h-5 w-5" />
              <span>Delete Overtime Record</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this overtime record? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                disabled={deletingLoading}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteOT(deletingId)}
                disabled={deletingLoading}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                {deletingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Delete Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transparent Calculation Trace Modal */}
      {activeTrace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-sm">Calculation Audit Trace</h3>
              </div>
              <button
                onClick={() => setActiveTrace(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-slate-400 text-[10px] uppercase font-semibold">Shift Name</div>
                <div className="font-bold text-slate-800">{activeTrace.shiftName}</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-slate-400 text-[10px] uppercase font-semibold">Scheduled Hours</div>
                <div className="font-bold text-slate-800">
                  {activeTrace.scheduledStart} – {activeTrace.scheduledEnd}
                </div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-slate-400 text-[10px] uppercase font-semibold">OT Boundary</div>
                <div className="font-bold text-slate-800">{activeTrace.otBoundary}</div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-slate-400 text-[10px] uppercase font-semibold">Submitted Interval</div>
                <div className="font-bold text-slate-800">
                  {activeTrace.startTime} – {activeTrace.endTime}
                </div>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <div className="text-slate-400 text-[10px] uppercase font-semibold">Raw Duration</div>
                <div className="font-bold text-slate-800">{activeTrace.rawHours}h</div>
              </div>
              <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100 text-blue-900">
                <div className="text-blue-500 text-[10px] uppercase font-semibold">Final Payable</div>
                <div className="font-extrabold text-sm">{activeTrace.payableHours}h</div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
              <span className="font-semibold text-slate-700">Classification: </span>
              {activeTrace.isHoliday
                ? `Official Holiday (${activeTrace.holidayName})`
                : activeTrace.isSunday
                ? 'Sunday (1.25× Weekend Multiplier)'
                : 'Regular Working Day (1.00× Multiplier)'}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveTrace(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
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
