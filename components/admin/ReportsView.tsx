'use client';

import { useState, useEffect } from 'react';
import {
  getReportsSummaryAction,
  exportReportsAction,
  exportOTReportAction,
  exportExpenseReportAction,
  ReportsSummaryResult,
  MonthlyReportsResult,
} from '@/app/actions/reports';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { formatCurrency } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import {
  Search,
  Calendar,
  Clock,
  Receipt,
  FileText,
  Download,
  Users,
  X,
  Filter,
  Check,
  Loader2,
} from 'lucide-react';
import { CustomSelect } from '@/components/ui/CustomSelect';

interface ReportsViewProps {
  initialData: MonthlyReportsResult | ReportsSummaryResult;
}

export function ReportsView({ initialData }: ReportsViewProps) {
  const toast = useToast();

  const today = new Date().toISOString().split('T')[0];
  const firstDayOfCurrentMonth = `${today.substring(0, 7)}-01`;

  const [fromDate, setFromDate] = useState<string>(
    'fromDate' in initialData && initialData.fromDate ? initialData.fromDate : firstDayOfCurrentMonth
  );
  const [toDate, setToDate] = useState<string>(
    'toDate' in initialData && initialData.toDate ? initialData.toDate : today
  );

  const [summaries, setSummaries] = useState(initialData.summaries);
  const [total, setTotal] = useState(initialData.total);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const [grandTotalOtHours, setGrandTotalOtHours] = useState(initialData.grandTotalOtHours);
  const [grandTotalExpenses, setGrandTotalExpenses] = useState(initialData.grandTotalExpenses);

  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [onlyActiveUsers, setOnlyActiveUsers] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function loadData(
    from: string,
    to: string,
    page: number,
    size: number,
    search: string,
    by = sortBy,
    order = sortOrder,
    activeOnly = onlyActiveUsers
  ) {
    setLoading(true);
    try {
      const res = await getReportsSummaryAction({
        fromDate: from,
        toDate: to,
        page,
        limit: size,
        search,
        sortBy: by,
        sortOrder: order,
        onlyActiveUsers: activeOnly,
      });
      setSummaries(res.summaries);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setGrandTotalOtHours(res.grandTotalOtHours);
      setGrandTotalExpenses(res.grandTotalExpenses);
      setCurrentPage(res.page);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(fromDate, toDate, currentPage, pageSize, searchTerm, sortBy, sortOrder, onlyActiveUsers);
  }, [fromDate, toDate, currentPage, pageSize, searchTerm, sortBy, sortOrder, onlyActiveUsers]);

  // Preset Date Ranges
  function applyPreset(preset: 'thisMonth' | 'lastMonth' | 'last30' | 'ytd') {
    const now = new Date();
    if (preset === 'thisMonth') {
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      setFromDate(start);
      setToDate(now.toISOString().split('T')[0]);
    } else if (preset === 'lastMonth') {
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const start = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
      const end = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      setFromDate(start);
      setToDate(end);
    } else if (preset === 'last30') {
      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      setFromDate(past.toISOString().split('T')[0]);
      setToDate(now.toISOString().split('T')[0]);
    } else if (preset === 'ytd') {
      setFromDate(`${now.getFullYear()}-01-01`);
      setToDate(now.toISOString().split('T')[0]);
    }
    setCurrentPage(1);
  }

  // Export OT Report CSV
  async function handleExportOT() {
    setExporting(true);
    try {
      const rows = await exportOTReportAction(fromDate, toDate, searchTerm);
      const headers = ['Employee Code', 'Full Name', 'Department', 'Shift', 'Work Date', 'Start Time', 'End Time', 'Payable Hours', 'Status'];
      const csvRows = rows.map((r) => [
        `"${r.employeeCode}"`,
        `"${r.fullName.replace(/"/g, '""')}"`,
        `"${(r.department || '').replace(/"/g, '""')}"`,
        `"${(r.shiftName || '').replace(/"/g, '""')}"`,
        `"${r.workDate}"`,
        `"${r.startTime}"`,
        `"${r.endTime}"`,
        r.payableHours,
        `"${r.status}"`,
      ]);
      const csvContent =
        'data:text/csv;charset=utf-8,' + [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `ot_report_${fromDate}_to_${toDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Exported ${rows.length} OT records to CSV.`);
    } catch (err: any) {
      toast.error('Failed to export OT report.');
    } finally {
      setExporting(false);
    }
  }

  // Export Expense Report CSV
  async function handleExportExpense() {
    setExporting(true);
    try {
      const rows = await exportExpenseReportAction(fromDate, toDate, searchTerm);
      const headers = ['Employee Code', 'Full Name', 'Department', 'Expense Date', 'Category', 'Amount (INR)', 'Description', 'Status'];
      const csvRows = rows.map((r) => [
        `"${r.employeeCode}"`,
        `"${r.fullName.replace(/"/g, '""')}"`,
        `"${(r.department || '').replace(/"/g, '""')}"`,
        `"${r.expenseDate}"`,
        `"${(r.categoryName || '').replace(/"/g, '""')}"`,
        r.amount,
        `"${r.description.replace(/"/g, '""')}"`,
        `"${r.status}"`,
      ]);
      const csvContent =
        'data:text/csv;charset=utf-8,' + [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `expense_report_${fromDate}_to_${toDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Exported ${rows.length} expense records to CSV.`);
    } catch (err: any) {
      toast.error('Failed to export expense report.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Date Range & Controls Toolbar */}
      <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        {/* Date Range Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <Calendar className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <span className="font-semibold text-slate-600">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setCurrentPage(1);
              }}
              className="font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
            <Calendar className="h-4 w-4 text-blue-600 flex-shrink-0" />
            <span className="font-semibold text-slate-600">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setCurrentPage(1);
              }}
              className="font-bold text-slate-800 bg-transparent focus:outline-none cursor-pointer text-xs"
            />
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => applyPreset('thisMonth')}
              className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              This Month
            </button>
            <button
              onClick={() => applyPreset('lastMonth')}
              className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              Last Month
            </button>
            <button
              onClick={() => applyPreset('last30')}
              className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
            >
              Last 30 Days
            </button>
          </div>
        </div>

        {/* Action Controls & Separate Export Buttons */}
        <div className="flex flex-wrap items-center gap-2 justify-between xl:justify-end">
          {/* Active Users Toggle */}
          <button
            onClick={() => {
              setOnlyActiveUsers(!onlyActiveUsers);
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              onlyActiveUsers
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
            title="Toggle between showing all users vs users with OT/Expenses only"
          >
            <Filter className="h-3.5 w-3.5 text-blue-600" />
            <span>Active Claimants Only</span>
            {onlyActiveUsers && <Check className="h-3.5 w-3.5 text-blue-600" />}
          </button>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
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
                { value: 'name_asc', label: 'Name (A - Z)' },
                { value: 'code_asc', label: 'Code (Ascending)' },
                { value: 'otHours_desc', label: 'OT Hours (High to Low)' },
                { value: 'otHours_asc', label: 'OT Hours (Low to High)' },
                { value: 'expenseAmount_desc', label: 'Expenses (High to Low)' },
                { value: 'expenseAmount_asc', label: 'Expenses (Low to High)' },
              ]}
            />
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search code or name..."
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
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-full"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Separate Export Buttons for OT and Expenses */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportOT}
              disabled={exporting}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-2xs"
              title="Export OT Records breakdown as CSV"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Clock className="h-3.5 w-3.5" />
                  <span>Export OT (.csv)</span>
                </>
              )}
            </button>

            <button
              onClick={handleExportExpense}
              disabled={exporting}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-2xs"
              title="Export Expense Claims breakdown as CSV"
            >
              {exporting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <Receipt className="h-3.5 w-3.5" />
                  <span>Export Expense (.csv)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Date-Range KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Staff With Claims ({fromDate} to {toDate})
            </span>
            <Users className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900 mt-2 font-mono">{total}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {onlyActiveUsers ? 'Employees with OT or Expense records' : 'All registered employees'}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Approved OT Hours ({fromDate} to {toDate})
            </span>
            <Clock className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-600 mt-2 font-mono">
            {grandTotalOtHours.toFixed(2)}h
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Total payable overtime within range</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Approved Expenses ({fromDate} to {toDate})
            </span>
            <Receipt className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="text-2xl font-extrabold text-indigo-600 mt-2 font-mono">
            {formatCurrency(grandTotalExpenses)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Total approved reimbursement within range</div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <TableSkeleton columns={7} rows={8} />
        ) : summaries.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-semibold text-slate-700">No records found for date range</h3>
            <p className="mt-1">
              No employee activity matching criteria between {fromDate} and {toDate}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Code</th>
                  <th className="px-4 py-3.5">Full Name</th>
                  <th className="px-4 py-3.5">Department</th>
                  <th className="px-4 py-3.5">Assigned Shift</th>
                  <th className="px-4 py-3.5 font-bold text-slate-900">Approved OT</th>
                  <th className="px-4 py-3.5 font-bold text-slate-900">Approved Expenses</th>
                  <th className="px-4 py-3.5">Pending Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaries.map((s) => (
                  <tr key={s.employeeCode} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5 font-mono font-bold text-slate-900">
                      {s.employeeCode}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-slate-900">{s.fullName}</td>
                    <td className="px-4 py-3.5 text-slate-600 font-medium">
                      {s.department || 'General'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-medium rounded border border-slate-200">
                        {s.shiftName}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-blue-600 text-sm">
                      {s.totalOtHours.toFixed(2)}h
                    </td>
                    <td className="px-4 py-3.5 font-mono font-extrabold text-slate-900 text-sm">
                      {formatCurrency(s.totalApprovedExpenses)}
                    </td>
                    <td className="px-4 py-3.5">
                      {s.pendingOtCount === 0 && s.pendingExpenseCount === 0 ? (
                        <span className="text-slate-400 text-[11px]">All clear</span>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {s.pendingOtCount > 0 && (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              {s.pendingOtCount} OT pending
                            </span>
                          )}
                          {s.pendingExpenseCount > 0 && (
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {s.pendingExpenseCount} Exp pending
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
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
    </div>
  );
}
