'use client';

import { useState, useEffect } from 'react';
import { getMyExpensesPaginatedAction, deleteMyExpenseAction, getExpenseAttachmentsAction } from '@/app/actions/expenses';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { Receipt, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronDown, ChevronUp, Trash2, Loader2, Search, ArrowUpDown, X, Eye, Printer, FileImage } from 'lucide-react';
import { formatCurrency, formatDateDisplay, formatDateTimeDisplay, escapeHtml } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { CustomSelect } from '@/components/ui/CustomSelect';
import Link from 'next/link';

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
}

export function ExpenseHistoryView() {
  const toast = useToast();
  const [records, setRecords] = useState<ExpenseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('submittedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [expandedMobileId, setExpandedMobileId] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  async function loadData(page: number, size: number, status: string, search: string, by = sortBy, order = sortOrder) {
    setLoading(true);
    try {
      const res = await getMyExpensesPaginatedAction({
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
      console.error('Failed to load expenses:', err);
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

  async function handleDeleteExpense(id: string) {
    setDeletingLoading(true);
    try {
      await deleteMyExpenseAction(id);
      toast.success('Expense claim deleted successfully.');
      setDeletingId(null);
      loadData(currentPage, pageSize, statusFilter, searchTerm, sortBy, sortOrder);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete expense claim.');
    } finally {
      setDeletingLoading(false);
    }
  }

  // Receipt Modal & Print State
  const [receiptModalItem, setReceiptModalItem] = useState<ExpenseItem | null>(null);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ id: string; filename: string; mimeType: string; url: string }>>([]);

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
            <div class="meta-item"><span class="meta-label">Claim Amount:</span> ₹${item.amount.toFixed(2)}</div>
            <div class="meta-item"><span class="meta-label">Expense Date:</span> ${escapeHtml(item.expenseDate)}</div>
            <div class="meta-item"><span class="meta-label">Category:</span> ${escapeHtml(item.categoryName)}</div>
            <div class="meta-item"><span class="meta-label">Status:</span> ${escapeHtml(item.status)}</div>
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
    <div className="space-y-5">
      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search category, description..."
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
            ]}
          />
          <CustomSelect
            size="sm"
            className="w-full"
            value={statusFilter}
            onChange={(st) => handleStatusChange(st)}
            options={[
              { value: 'ALL', label: 'All Claims' },
              { value: 'SUBMITTED', label: 'Submitted' },
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
              ]}
            />
          </div>

          <div className="flex items-center gap-1.5">
            {['ALL', 'SUBMITTED', 'APPROVED', 'REJECTED'].map((st) => (
              <button
                key={st}
                onClick={() => handleStatusChange(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                  statusFilter === st
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st === 'ALL' ? 'All Claims' : st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <TableSkeleton columns={5} rows={6} />
      ) : records.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <Receipt className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-800">No expense claims found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {statusFilter !== 'ALL'
              ? `No claims matching status "${statusFilter}". Try selecting another tab.`
              : 'You have not submitted any expense claims yet.'}
          </p>
          <div className="mt-4">
            <Link
              href="/expenses/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm"
            >
              Submit Expense Claim
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
                  <th className="px-5 py-3.5">Expense Date</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5 font-bold text-slate-900">Claim Amount</th>
                  <th className="px-5 py-3.5">Description</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{formatDateDisplay(e.expenseDate)}</td>
                    <td className="px-5 py-3.5">
                      <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-semibold rounded-md border border-slate-200">
                        {e.categoryName}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-extrabold text-slate-900 text-sm font-mono">
                      {formatCurrency(e.amount)}
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <div className="truncate text-slate-800 font-medium" title={e.description}>
                        {e.description}
                      </div>
                      {e.isFlaggedDuplicate && (
                        <div className="flex items-center gap-1 text-[11px] text-amber-700 mt-1">
                          <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{e.duplicateReason || 'Flagged duplicate'}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          e.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : e.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {e.status === 'APPROVED' && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                        {e.status === 'REJECTED' && <XCircle className="h-3 w-3 text-rose-600" />}
                        {e.status === 'SUBMITTED' && <Clock className="h-3 w-3 text-amber-600" />}
                        {e.status}
                      </span>

                      {/* Timestamps */}
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
                        <div className="text-[10px] text-rose-600 mt-1 max-w-xs truncate">
                          Reason: {e.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openReceiptModal(e)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold hover:bg-blue-100 transition-colors"
                          title="View & Print Uploaded Receipts"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Receipts
                        </button>
                        {e.status !== 'APPROVED' && (
                          <button
                            onClick={() => setDeletingId(e.id)}
                            className="p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete My Expense Claim"
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

          {/* Mobile Card Layout */}
          <div className="md:hidden divide-y divide-slate-100">
            {records.map((e) => {
              const isExpanded = expandedMobileId === e.id;
              return (
                <div key={`m-${e.id}`} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-sm">{formatDateDisplay(e.expenseDate)}</span>
                      <span className="ml-2 px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-semibold rounded">
                        {e.categoryName}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-extrabold text-slate-900 font-mono">
                        {formatCurrency(e.amount)}
                      </div>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          e.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : e.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {e.status}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2">{e.description}</p>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-50">
                    <span className="text-[11px] text-slate-400">
                      Created {formatDateTimeDisplay(e.submittedAt)}
                    </span>
                    <button
                      onClick={() => setExpandedMobileId(isExpanded ? null : e.id)}
                      className="inline-flex items-center gap-1 text-slate-600 text-xs font-medium"
                    >
                      {isExpanded ? 'Less' : 'Details'}
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-2 animate-slide-up">
                      {e.reviewedAt && (
                        <div className="text-[11px] text-emerald-700 font-medium">
                          Approved: {formatDateTimeDisplay(e.reviewedAt)}
                        </div>
                      )}
                      {e.isFlaggedDuplicate && (
                        <div className="p-2 rounded bg-amber-100/70 border border-amber-200 text-amber-800 text-[11px]">
                          <strong>Duplicate Warning:</strong> {e.duplicateReason || 'Potential duplicate match detected'}
                        </div>
                      )}
                      {e.rejectionReason && (
                        <div className="text-rose-700 font-medium">Rejection Reason: {e.rejectionReason}</div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                        <button
                          onClick={() => openReceiptModal(e)}
                          className="inline-flex items-center gap-1 text-blue-600 font-semibold text-xs"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Receipts & Print
                        </button>
                        {e.status !== 'APPROVED' && (
                          <button
                            onClick={() => setDeletingId(e.id)}
                            className="text-rose-600 font-semibold inline-flex items-center gap-1 text-xs"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete Claim
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
          <div className="relative my-auto bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 space-y-3 animate-slide-up">
            <div className="flex items-center gap-2.5 text-rose-600 font-bold text-sm">
              <Trash2 className="h-5 w-5" />
              <span>Delete Expense Claim</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete this expense claim? This action cannot be undone.
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
                onClick={() => handleDeleteExpense(deletingId)}
                disabled={deletingLoading}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                {deletingLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Delete Claim
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
                  ₹{receiptModalItem.amount.toFixed(2)} • {receiptModalItem.categoryName} • Status: {receiptModalItem.status}
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
