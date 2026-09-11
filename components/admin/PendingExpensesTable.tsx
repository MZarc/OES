'use client';

import { useState, useEffect } from 'react';
import {
  approveExpenseAction,
  rejectExpenseAction,
  undoExpenseAction,
  getAdminExpensesPaginatedAction,
  getExpenseAttachmentsAction,
} from '@/app/actions/expenses';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import {
  Check,
  X,
  AlertTriangle,
  Search,
  AlertCircle,
  Loader2,
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  ArrowUpDown,
  Printer,
  FileImage,
  Eye,
} from 'lucide-react';
import { formatCurrency, formatDateDisplay, formatDateTimeDisplay, escapeHtml } from '@/lib/utils';

interface ExpenseItem {
  id: string;
  expenseDate: string;
  categoryName: string;
  amount: number;
  description: string;
  status: string;
  isFlaggedDuplicate: boolean;
  duplicateReason?: string | null;
  rejectionReason?: string | null;
  submittedAt: Date | string;
  reviewedAt?: Date | string | null;
  employeeName: string;
  employeeCode: string;
  department: string | null;
}

interface PendingExpensesTableProps {
  initialExpenses?: ExpenseItem[];
  expenses?: ExpenseItem[];
}

import { useToast } from '@/components/ui/Toast';
import { CustomSelect } from '@/components/ui/CustomSelect';

export function PendingExpensesTable({ initialExpenses, expenses }: PendingExpensesTableProps) {
  const toast = useToast();
  const defaultItems = initialExpenses || expenses || [];
  const [items, setItems] = useState<ExpenseItem[]>(defaultItems);
  const [total, setTotal] = useState(defaultItems.length);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('SUBMITTED');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('submittedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(false);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Receipt Modal & Print State
  const [receiptModalItem, setReceiptModalItem] = useState<ExpenseItem | null>(null);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ id: string; filename: string; mimeType: string; url: string }>>([]);

  async function fetchPage(
    page: number,
    size: number,
    status: string,
    category: string,
    search: string,
    by = sortBy,
    order = sortOrder
  ) {
    setLoading(true);
    try {
      const res = await getAdminExpensesPaginatedAction({
        page,
        limit: size,
        status,
        category,
        search,
        sortBy: by,
        sortOrder: order,
      });
      setItems(res.records as any);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setCurrentPage(res.page);
    } catch (err: any) {
      toast.error(err.message || 'Error fetching expense records.');
    } finally {
      setLoading(false);
    }
  }

  // Reload data whenever page, size, status, category, search, or sort changes
  useEffect(() => {
    fetchPage(currentPage, pageSize, statusFilter, categoryFilter, searchTerm, sortBy, sortOrder);
  }, [currentPage, pageSize, statusFilter, categoryFilter, searchTerm, sortBy, sortOrder]);

  async function handleApprove(id: string) {
    setProcessingId(id);
    try {
      await approveExpenseAction(id);
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: 'APPROVED' } : i))
      );
      toast.success('Expense claim approved successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve expense.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleConfirmReject() {
    if (!rejectingId || !rejectReason.trim()) return;
    setProcessingId(rejectingId);
    try {
      await rejectExpenseAction(rejectingId, rejectReason);
      setItems((prev) =>
        prev.map((i) =>
          i.id === rejectingId
            ? { ...i, status: 'REJECTED', rejectionReason: rejectReason }
            : i
        )
      );
      toast.success('Expense claim rejected with recorded feedback.');
      setRejectingId(null);
      setRejectReason('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject expense.');
    } finally {
      setProcessingId(null);
    }
  }

  async function handleUndo(id: string) {
    setProcessingId(id);
    try {
      await undoExpenseAction(id);
      setItems((prev) =>
        prev.map((i) =>
          i.id === id
            ? { ...i, status: 'SUBMITTED', rejectionReason: null, reviewedAt: null }
            : i
        )
      );
      toast.success('Action undone. Expense returned to pending queue.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to undo action.');
    } finally {
      setProcessingId(null);
    }
  }

  async function openReceiptModal(item: ExpenseItem) {
    setReceiptModalItem(item);
    setAttachmentsLoading(true);
    try {
      const atts = await getExpenseAttachmentsAction(item.id);
      setAttachments(atts);
    } catch (err: any) {
      toast.error('Failed to load receipt attachments.');
    } finally {
      setAttachmentsLoading(false);
    }
  }

  function handlePrintReceipts(item: ExpenseItem, atts: typeof attachments) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const imagesHtml = atts
      .map(
        (a) => `
        <div style="margin-bottom: 24px; text-align: center; page-break-inside: avoid;">
          <p style="font-size: 12px; color: #475569; margin-bottom: 6px;"><strong>Attachment:</strong> ${escapeHtml(a.filename)}</p>
          ${
            a.mimeType.includes('image') || a.url.includes('.webp') || a.url.includes('.png') || a.url.includes('.jpg')
              ? `<img src="${encodeURI(a.url)}" alt="Receipt" style="max-width: 100%; max-height: 700px; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);" />`
              : `<div style="padding: 20px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc;">Document Attachment: ${escapeHtml(a.filename)}</div>`
          }
        </div>
      `
      )
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Expense Claim Receipts - ${escapeHtml(item.id)}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 30px; color: #0f172a; }
            .header { border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
            .title { font-size: 20px; font-weight: 800; color: #1e293b; margin: 0; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 28px; }
            .meta-item { font-size: 13px; }
            .meta-label { font-weight: bold; color: #64748b; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">OES Expense Claim Receipt & Verification Record</h1>
            <p style="font-size: 12px; color: #64748b; margin-top: 4px;">Claim Reference ID: ${escapeHtml(item.id)}</p>
          </div>
          <div class="meta">
            <div class="meta-item"><span class="meta-label">Employee:</span> ${escapeHtml(item.employeeName)} (${escapeHtml(item.employeeCode)})</div>
            <div class="meta-item"><span class="meta-label">Claim Amount:</span> ₹${item.amount.toFixed(2)}</div>
            <div class="meta-item"><span class="meta-label">Expense Date:</span> ${escapeHtml(item.expenseDate)}</div>
            <div class="meta-item"><span class="meta-label">Category:</span> ${escapeHtml(item.categoryName)}</div>
            <div class="meta-item" style="grid-column: span 2;"><span class="meta-label">Description:</span> ${escapeHtml(item.description)}</div>
          </div>
          <h3 style="font-size: 14px; font-weight: bold; margin-bottom: 16px;">Attached Receipts & Proof Documents (${atts.length})</h3>
          ${imagesHtml || '<p style="color: #94a3b8;">No physical receipt attachments uploaded for this claim.</p>'}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }

  return (
    <div className="space-y-4">
      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee, description, or code..."
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

        {/* Mobile Controls Grid (Zero horizontal scroll) */}
        <div className="grid grid-cols-2 gap-2 w-full sm:hidden">
          <CustomSelect
            size="sm"
            className="w-full"
            value={`${sortBy}_${sortOrder}`}
            onChange={(val) => {
              const [b, o] = val.split('_');
              setSortBy(b);
              setSortOrder(o as 'asc' | 'desc');
              setCurrentPage(1);
            }}
            options={[
              { value: 'submittedAt_desc', label: 'Submitted (New)' },
              { value: 'submittedAt_asc', label: 'Submitted (Old)' },
              { value: 'expenseDate_desc', label: 'Expense Date (New)' },
              { value: 'expenseDate_asc', label: 'Expense Date (Old)' },
              { value: 'amount_desc', label: 'Amount (High)' },
              { value: 'amount_asc', label: 'Amount (Low)' },
              { value: 'fullName_asc', label: 'Employee (A-Z)' },
            ]}
          />
          <CustomSelect
            size="sm"
            className="w-full"
            value={statusFilter}
            onChange={(st) => {
              setStatusFilter(st);
              setCurrentPage(1);
            }}
            options={[
              { value: 'SUBMITTED', label: 'Pending Review' },
              { value: 'ALL', label: 'All Claims' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REJECTED', label: 'Rejected' },
            ]}
          />
        </div>

        {/* Desktop Controls (Fast 1-click pills) */}
        <div className="hidden sm:flex items-center gap-2">
          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-medium text-slate-500">Sort:</span>
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
                { value: 'expenseDate_desc', label: 'Expense Date (Newest)' },
                { value: 'expenseDate_asc', label: 'Expense Date (Oldest)' },
                { value: 'amount_desc', label: 'Amount (High to Low)' },
                { value: 'amount_asc', label: 'Amount (Low to High)' },
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
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st === 'SUBMITTED' ? 'Pending Review' : st === 'ALL' ? 'All Claims' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <TableSkeleton columns={6} rows={6} />
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <Receipt className="h-9 w-9 text-slate-300 mx-auto mb-2" />
            No expense claims found matching the current criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Employee</th>
                  <th className="px-4 py-3.5">Expense Date</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5 font-bold text-slate-900">Claim Amount</th>
                  <th className="px-4 py-3.5">Description & Warnings</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-slate-900">{e.employeeName}</div>
                      <div className="text-[11px] text-slate-500">
                        {e.employeeCode} • {e.department || 'General'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-800">{formatDateDisplay(e.expenseDate)}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-semibold rounded-md border border-slate-200">
                        {e.categoryName}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-extrabold text-slate-900 font-mono text-sm">
                      {formatCurrency(e.amount)}
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <div className="truncate text-slate-800 font-medium" title={e.description}>
                        {e.description}
                      </div>
                      {e.isFlaggedDuplicate && (
                        <div className="flex items-center gap-1 text-[11px] text-amber-700 mt-1">
                          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-600" />
                          <span className="truncate font-semibold">{e.duplicateReason || 'Flagged Duplicate'}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          e.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : e.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {e.status === 'APPROVED' && <CheckCircle2 className="h-3 w-3" />}
                        {e.status === 'REJECTED' && <XCircle className="h-3 w-3" />}
                        {e.status === 'SUBMITTED' && <Clock className="h-3 w-3" />}
                        {e.status}
                      </span>

                      {/* Created and Reviewed Timestamps */}
                      <div className="text-[10px] text-slate-400 mt-1 space-y-0.5 whitespace-nowrap">
                        <div>
                          <span className="text-slate-500 font-medium">Created:</span>{' '}
                          {formatDateTimeDisplay(e.submittedAt)}
                        </div>
                        {e.reviewedAt && (
                          <div className="text-emerald-700 font-medium">
                            <span>Approved:</span> {formatDateTimeDisplay(e.reviewedAt)}
                          </div>
                        )}
                      </div>

                      {e.rejectionReason && (
                        <div
                          className="text-[10px] text-rose-600 mt-0.5 max-w-xs truncate font-medium"
                          title={e.rejectionReason}
                        >
                          Reason: {e.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openReceiptModal(e)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
                          title="View & Print Uploaded Receipts"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Receipts
                        </button>

                        {e.status === 'SUBMITTED' && (
                          <>
                            <button
                              onClick={() => handleApprove(e.id)}
                              disabled={processingId === e.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 shadow-2xs"
                            >
                              {processingId === e.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5" />
                              )}
                              Approve
                            </button>

                            <button
                              onClick={() => {
                                setRejectingId(e.id);
                                setRejectReason('');
                              }}
                              disabled={processingId === e.id}
                              className="inline-flex items-center gap-1 px-2 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold hover:bg-rose-100 disabled:opacity-50"
                            >
                              <X className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          </>
                        )}

                        {(e.status === 'APPROVED' || e.status === 'REJECTED') && (
                          <button
                            onClick={() => handleUndo(e.id)}
                            disabled={processingId === e.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-semibold hover:bg-amber-100 disabled:opacity-50 transition-colors shadow-2xs"
                            title="Revert back to Pending status"
                          >
                            {processingId === e.id ? (
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

      {/* Rejection Modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
          <div className="relative my-auto bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto animate-slide-up">
            <h3 className="text-base font-bold text-slate-900">Reject Expense Claim</h3>
            <p className="text-xs text-slate-500">
              A rejection reason is mandatory. The employee will receive this feedback in their portal.
            </p>
            <textarea
              required
              rows={3}
              placeholder="e.g. Missing receipt attachment; invoice amount mismatch."
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
      {/* Receipt Preview & Print Modal */}
      {receiptModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
          <div className="relative my-auto bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col justify-between">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileImage className="h-5 w-5 text-blue-600" />
                  Receipt Files & Claim Evidence
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {receiptModalItem.employeeName} ({receiptModalItem.employeeCode}) • ₹{receiptModalItem.amount.toFixed(2)} • {receiptModalItem.categoryName}
                </p>
              </div>
              <button
                onClick={() => setReceiptModalItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 py-2">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <div><strong>Description:</strong> {receiptModalItem.description}</div>
                <div><strong>Expense Date:</strong> {formatDateDisplay(receiptModalItem.expenseDate)}</div>
                <div><strong>Submission Date:</strong> {formatDateTimeDisplay(receiptModalItem.submittedAt)}</div>
              </div>

              {attachmentsLoading ? (
                <div className="flex items-center justify-center p-12 text-blue-600 space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : attachments.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border">
                  No uploaded receipt files attached to this claim.
                </div>
              ) : (
                <div className="space-y-4">
                  {attachments.map((att) => (
                    <div key={att.id} className="p-3 border rounded-xl bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                        <span>{att.filename}</span>
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-[11px]"
                        >
                          Open Full Image
                        </a>
                      </div>
                      {att.mimeType?.includes('image') || att.url.includes('.webp') || att.url.includes('.png') || att.url.includes('.jpg') ? (
                        <img
                          src={att.url}
                          alt={att.filename}
                          className="max-h-96 w-full object-contain rounded-lg border bg-white shadow-xs"
                        />
                      ) : (
                        <div className="p-4 bg-white border rounded-lg text-center text-xs text-slate-600">
                          Document File ({att.filename})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t pt-3">
              <button
                type="button"
                onClick={() => setReceiptModalItem(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handlePrintReceipts(receiptModalItem, attachments)}
                disabled={attachmentsLoading || attachments.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-xs"
              >
                <Printer className="h-4 w-4" />
                Direct Print Receipts & Claim Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
