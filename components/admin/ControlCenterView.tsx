'use client';

import { useState, useEffect } from 'react';
import {
  getControlCenterOTAction,
  getControlCenterExpensesAction,
  hardDeleteOTRecordsAction,
  hardDeleteExpenseRecordsAction,
  hardDeleteAllUploadedImagesAction,
  factoryResetSystemDataAction,
} from '@/app/actions/maintenance';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { formatCurrency, formatDateTimeDisplay, formatDateDisplay } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { CustomSelect } from '@/components/ui/CustomSelect';
import {
  SlidersHorizontal,
  Trash2,
  AlertTriangle,
  Calendar,
  Search,
  X,
  CheckCircle2,
  Loader2,
  Clock,
  Receipt,
  FileImage,
  Flame,
  ShieldAlert,
  ArrowUpDown,
} from 'lucide-react';

export function ControlCenterView() {
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<'ot' | 'expenses' | 'danger'>('ot');

  // Common Filter States
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Data States
  const [otData, setOtData] = useState<any>({ records: [], total: 0, totalPages: 1 });
  const [expenseData, setExpenseData] = useState<any>({ records: [], total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Selection
  const [selectedOtIds, setSelectedOtIds] = useState<string[]>([]);
  const [selectedExpIds, setSelectedExpIds] = useState<string[]>([]);

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionType: 'delete_ot' | 'delete_expense' | 'purge_images' | 'factory_reset';
  }>({
    isOpen: false,
    title: '',
    description: '',
    actionType: 'delete_ot',
  });
  const [resetConfirmPhrase, setResetConfirmPhrase] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');

  // Load Data
  async function loadData() {
    setLoading(true);
    try {
      if (activeTab === 'ot') {
        const res = await getControlCenterOTAction({
          fromDate,
          toDate,
          status: statusFilter,
          search: searchTerm,
          page: currentPage,
          limit: pageSize,
          sortBy,
          sortOrder,
        });
        setOtData(res);
      } else if (activeTab === 'expenses') {
        const res = await getControlCenterExpensesAction({
          fromDate,
          toDate,
          status: statusFilter,
          category: categoryFilter,
          search: searchTerm,
          page: currentPage,
          limit: pageSize,
          sortBy,
          sortOrder,
        });
        setExpenseData(res);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load maintenance records.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [activeTab, fromDate, toDate, statusFilter, categoryFilter, searchTerm, sortBy, sortOrder, currentPage, pageSize]);

  // Selection Handlers
  function handleSelectAllOt() {
    if (selectedOtIds.length === otData.records.length) {
      setSelectedOtIds([]);
    } else {
      setSelectedOtIds(otData.records.map((r: any) => r.id));
    }
  }

  function handleSelectAllExp() {
    if (selectedExpIds.length === expenseData.records.length) {
      setSelectedExpIds([]);
    } else {
      setSelectedExpIds(expenseData.records.map((r: any) => r.id));
    }
  }

  // Execution Handlers
  async function executeAction() {
    if (!adminPasswordConfirm) {
      toast.error('Admin login password is required to confirm deletion.');
      return;
    }

    setActionLoading(true);
    try {
      if (confirmModal.actionType === 'delete_ot') {
        const res = await hardDeleteOTRecordsAction(selectedOtIds, adminPasswordConfirm);
        toast.success(`Permanently hard deleted ${res.count} OT record(s).`);
        setSelectedOtIds([]);
      } else if (confirmModal.actionType === 'delete_expense') {
        const res = await hardDeleteExpenseRecordsAction(selectedExpIds, adminPasswordConfirm);
        toast.success(
          `Permanently deleted ${res.count} expense record(s) and ${res.purgedFilesCount} receipt file(s).`
        );
        setSelectedExpIds([]);
      } else if (confirmModal.actionType === 'purge_images') {
        const res = await hardDeleteAllUploadedImagesAction(adminPasswordConfirm);
        toast.success(`Purged all ${res.purgedCount} uploaded receipt image file(s) from storage.`);
      } else if (confirmModal.actionType === 'factory_reset') {
        await factoryResetSystemDataAction(resetConfirmPhrase, adminPasswordConfirm);
        toast.success('Factory Reset Completed! All operational records permanently purged.');
      }
      setConfirmModal({ ...confirmModal, isOpen: false });
      setResetConfirmPhrase('');
      setAdminPasswordConfirm('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-rose-600" />
            System Control Center & Permanent Maintenance
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Administrative console to perform selective or bulk permanent hard deletions of operational data and storage files.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => {
              setActiveTab('ot');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'ot'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-blue-600" />
            OT Maintenance
          </button>
          <button
            onClick={() => {
              setActiveTab('expenses');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'expenses'
                ? 'bg-white text-slate-900 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Receipt className="h-3.5 w-3.5 text-indigo-600" />
            Expense Maintenance
          </button>
          <button
            onClick={() => setActiveTab('danger')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'danger'
                ? 'bg-rose-600 text-white shadow-2xs font-bold'
                : 'text-rose-600 hover:bg-rose-50'
            }`}
          >
            <Flame className="h-3.5 w-3.5" />
            Danger Zone
          </button>
        </div>
      </div>

      {/* OT MAINTENANCE TAB */}
      {activeTab === 'ot' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <Calendar className="h-4 w-4 text-slate-400" />
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
                <Calendar className="h-4 w-4 text-slate-400" />
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

              <CustomSelect
                size="sm"
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'SUBMITTED', label: 'Submitted (Pending)' },
                  { value: 'APPROVED', label: 'Approved' },
                  { value: 'REJECTED', label: 'Rejected' },
                ]}
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
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
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {selectedOtIds.length > 0 && (
                <button
                  onClick={() =>
                    setConfirmModal({
                      isOpen: true,
                      title: `Hard Delete ${selectedOtIds.length} OT Record(s)`,
                      description: `Are you sure you want to permanently delete ${selectedOtIds.length} OT record(s)? This action cannot be undone.`,
                      actionType: 'delete_ot',
                    })
                  }
                  className="flex items-center gap-1.5 bg-rose-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors shadow-2xs flex-shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hard Delete Selected ({selectedOtIds.length})
                </button>
              )}
            </div>
          </div>

          {/* OT Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {loading ? (
              <TableSkeleton columns={6} rows={10} />
            ) : otData.records.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <Clock className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <h3 className="font-semibold text-slate-700">No OT records match criteria</h3>
                <p className="mt-1">Adjust filters or search parameters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200 tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5 w-10">
                        <input
                          type="checkbox"
                          checked={
                            otData.records.length > 0 &&
                            otData.records.every((r: any) => selectedOtIds.includes(r.id))
                          }
                          onChange={handleSelectAllOt}
                          className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 h-3.5 w-3.5 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3.5">Employee</th>
                      <th className="px-4 py-3.5">Work Date</th>
                      <th className="px-4 py-3.5">Payable Hours</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-4 py-3.5">Created At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {otData.records.map((r: any) => {
                      const isSel = selectedOtIds.includes(r.id);
                      return (
                        <tr
                          key={r.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSel ? 'bg-rose-50/40' : ''
                          }`}
                        >
                          <td className="px-4 py-3.5">
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={() =>
                                setSelectedOtIds((prev) =>
                                  prev.includes(r.id)
                                    ? prev.filter((i) => i !== r.id)
                                    : [...prev, r.id]
                                )
                              }
                              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 h-3.5 w-3.5 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3.5 font-sans">
                            <div className="font-semibold text-slate-900">{r.employeeName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{r.employeeCode}</div>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-800">
                            {formatDateDisplay(r.workDate)}
                          </td>
                          <td className="px-4 py-3.5 font-mono font-bold text-blue-600">
                            {r.payableHours.toFixed(2)}h
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold ${
                                r.status === 'APPROVED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : r.status === 'REJECTED'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">
                            {formatDateTimeDisplay(r.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <Pagination
              currentPage={currentPage}
              totalPages={otData.totalPages}
              totalRecords={otData.total}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* EXPENSE MAINTENANCE TAB */}
      {activeTab === 'expenses' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col xl:flex-row gap-3 items-stretch xl:items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <Calendar className="h-4 w-4 text-slate-400" />
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
                <Calendar className="h-4 w-4 text-slate-400" />
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

              <CustomSelect
                size="sm"
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'All Statuses' },
                  { value: 'SUBMITTED', label: 'Submitted (Pending)' },
                  { value: 'APPROVED', label: 'Approved' },
                  { value: 'REJECTED', label: 'Rejected' },
                ]}
              />

              <CustomSelect
                size="sm"
                value={categoryFilter}
                onChange={(val) => {
                  setCategoryFilter(val);
                  setCurrentPage(1);
                }}
                options={[
                  { value: 'ALL', label: 'All Categories' },
                  { value: 'TRAVEL', label: 'Travel' },
                  { value: 'MEALS', label: 'Meals' },
                  { value: 'SUPPLIES', label: 'Supplies' },
                  { value: 'EQUIPMENT', label: 'Equipment' },
                  { value: 'OTHER', label: 'Other' },
                ]}
              />
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search code, name, merchant..."
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
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {selectedExpIds.length > 0 && (
                <button
                  onClick={() =>
                    setConfirmModal({
                      isOpen: true,
                      title: `Hard Delete ${selectedExpIds.length} Expense Record(s) & Receipts`,
                      description: `Are you sure you want to permanently delete ${selectedExpIds.length} expense record(s) and purge their associated files from object storage? This cannot be undone.`,
                      actionType: 'delete_expense',
                    })
                  }
                  className="flex items-center gap-1.5 bg-rose-600 text-white px-3.5 py-2 rounded-lg text-xs font-bold hover:bg-rose-700 transition-colors shadow-2xs flex-shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hard Delete Selected ({selectedExpIds.length})
                </button>
              )}
            </div>
          </div>

          {/* Expense Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {loading ? (
              <TableSkeleton columns={7} rows={10} />
            ) : expenseData.records.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs">
                <Receipt className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <h3 className="font-semibold text-slate-700">No expense records match criteria</h3>
                <p className="mt-1">Adjust filters or search parameters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200 tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5 w-10">
                        <input
                          type="checkbox"
                          checked={
                            expenseData.records.length > 0 &&
                            expenseData.records.every((r: any) => selectedExpIds.includes(r.id))
                          }
                          onChange={handleSelectAllExp}
                          className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 h-3.5 w-3.5 cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3.5">Employee</th>
                      <th className="px-4 py-3.5">Category & Merchant</th>
                      <th className="px-4 py-3.5">Amount</th>
                      <th className="px-4 py-3.5">Expense Date</th>
                      <th className="px-4 py-3.5">Receipt File</th>
                      <th className="px-4 py-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expenseData.records.map((r: any) => {
                      const isSel = selectedExpIds.includes(r.id);
                      return (
                        <tr
                          key={r.id}
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isSel ? 'bg-rose-50/40' : ''
                          }`}
                        >
                          <td className="px-4 py-3.5">
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={() =>
                                setSelectedExpIds((prev) =>
                                  prev.includes(r.id)
                                    ? prev.filter((i) => i !== r.id)
                                    : [...prev, r.id]
                                )
                              }
                              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 h-3.5 w-3.5 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3.5 font-sans">
                            <div className="font-semibold text-slate-900">{r.employeeName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{r.employeeCode}</div>
                          </td>
                          <td className="px-4 py-3.5 font-sans">
                            <div className="font-semibold text-slate-800">{r.category}</div>
                            <div className="text-[10px] text-slate-400">{r.merchantName || 'Direct'}</div>
                          </td>
                          <td className="px-4 py-3.5 font-mono font-extrabold text-slate-900">
                            {formatCurrency(r.amount)}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-slate-800">
                            {formatDateDisplay(r.expenseDate)}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[10px]">
                            {r.receiptStorageKey ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                <FileImage className="h-3 w-3 text-emerald-600" />
                                File Attached
                              </span>
                            ) : (
                              <span className="text-slate-400">No Receipt</span>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold ${
                                r.status === 'APPROVED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : r.status === 'REJECTED'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <Pagination
              currentPage={currentPage}
              totalPages={expenseData.totalPages}
              totalRecords={expenseData.total}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* DANGER ZONE TAB */}
      {activeTab === 'danger' && (
        <div className="space-y-6">
          <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3 text-rose-900 text-xs">
            <ShieldAlert className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-sm">System Maintenance Danger Zone</h3>
              <p className="mt-1 text-rose-700">
                Actions in this section perform permanent database truncations and object storage file purges. They cannot be reversed under any circumstances.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Purge All Receipt Images */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-base">
                  <FileImage className="h-5 w-5 text-amber-600" />
                  Purge All Uploaded Receipt Images
                </div>
                <p className="text-xs text-slate-500">
                  Permanently deletes all receipt image attachments stored in MinIO / S3 object storage while keeping expense metadata rows intact.
                </p>
              </div>

              <button
                onClick={() =>
                  setConfirmModal({
                    isOpen: true,
                    title: 'Purge All Uploaded Receipt Images',
                    description: 'Are you sure you want to delete ALL receipt attachment files from object storage? This cannot be undone.',
                    actionType: 'purge_images',
                  })
                }
                className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-colors shadow-2xs"
              >
                <Trash2 className="h-4 w-4" />
                Purge Storage Receipts
              </button>
            </div>

            {/* Factory Reset System Data */}
            <div className="bg-white p-6 rounded-2xl border border-rose-200 shadow-2xs space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-rose-900 font-bold text-base">
                  <Flame className="h-5 w-5 text-rose-600" />
                  Factory Reset System Operational Data
                </div>
                <p className="text-xs text-slate-500">
                  Permanently purges ALL OT records, Expenses, Receipt files, Import logs, and Audit logs while preserving employee credentials & shift policies.
                </p>
              </div>

              <button
                onClick={() =>
                  setConfirmModal({
                    isOpen: true,
                    title: 'Factory Reset System Data',
                    description: 'This will permanently wipe all operational records from PostgreSQL and MinIO. Type "PERMANENT RESET" below to confirm.',
                    actionType: 'factory_reset',
                  })
                }
                className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold transition-colors shadow-2xs"
              >
                <Flame className="h-4 w-4" />
                Execute Factory Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Safety Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
          <div className="relative my-auto bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                <AlertTriangle className="h-5 w-5" />
                {confirmModal.title}
              </div>
              <button
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">{confirmModal.description}</p>

            {confirmModal.actionType === 'factory_reset' && (
              <div>
                <label className="block text-xs font-bold text-rose-700 mb-1">
                  Type &quot;PERMANENT RESET&quot; to confirm:
                </label>
                <input
                  type="text"
                  value={resetConfirmPhrase}
                  onChange={(e) => setResetConfirmPhrase(e.target.value)}
                  placeholder="PERMANENT RESET"
                  className="w-full px-3 py-2 border border-rose-300 rounded-lg text-xs font-mono font-bold text-rose-900 focus:ring-1 focus:ring-rose-500 uppercase"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Enter Admin Login Password:
              </label>
              <input
                type="password"
                required
                value={adminPasswordConfirm}
                onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                placeholder="Enter your admin password..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-1 focus:ring-rose-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t">
              <button
                type="button"
                onClick={() => {
                  setConfirmModal({ ...confirmModal, isOpen: false });
                  setAdminPasswordConfirm('');
                }}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeAction}
                disabled={
                  actionLoading ||
                  !adminPasswordConfirm.trim() ||
                  (confirmModal.actionType === 'factory_reset' &&
                    resetConfirmPhrase.trim().toUpperCase() !== 'PERMANENT RESET')
                }
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-xs"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Executing Permanent Delete...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Confirm Permanent Hard Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
