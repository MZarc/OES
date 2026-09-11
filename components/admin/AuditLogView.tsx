'use client';

import { useState, useEffect } from 'react';
import { getAuditLogsPaginatedAction, AuditLogItem } from '@/app/actions/audit';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/TableSkeleton';
import { formatDateTimeDisplay } from '@/lib/utils';
import {
  ShieldCheck,
  Search,
  History,
  X,
  Eye,
  Copy,
  Check,
  FileJson,
} from 'lucide-react';
import { CustomSelect } from '@/components/ui/CustomSelect';

interface AuditLogViewProps {
  initialLogs?: AuditLogItem[];
  initialTotal?: number;
}

export function AuditLogView({ initialLogs = [], initialTotal = 0 }: AuditLogViewProps) {
  const [logs, setLogs] = useState<AuditLogItem[]>(initialLogs);
  const [total, setTotal] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(Math.ceil(initialTotal / 20) || 1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('timestamp');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(false);

  // Inspector Modal State
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [copied, setCopied] = useState(false);

  async function loadData(
    page: number,
    size: number,
    search: string,
    action: string,
    by = sortBy,
    order = sortOrder
  ) {
    setLoading(true);
    try {
      const res = await getAuditLogsPaginatedAction({
        page,
        limit: size,
        search,
        action,
        sortBy: by,
        sortOrder: order,
      });
      setLogs(res.logs);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setCurrentPage(res.page);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(currentPage, pageSize, searchTerm, actionFilter, sortBy, sortOrder);
  }, [currentPage, pageSize, searchTerm, actionFilter, sortBy, sortOrder]);

  function formatJsonPayload(jsonStr?: string | null): string {
    if (!jsonStr) return 'N/A';
    try {
      const parsed = JSON.parse(jsonStr);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      return jsonStr;
    }
  }

  function handleCopyJson(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search action, entity, or ID..."
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

        <div className="flex items-center gap-2 w-full sm:w-auto">
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
                { value: 'timestamp_desc', label: 'Timestamp (Newest)' },
                { value: 'timestamp_asc', label: 'Timestamp (Oldest)' },
                { value: 'action_asc', label: 'Action (A - Z)' },
              ]}
            />
          </div>

          <CustomSelect
            size="sm"
            value={actionFilter}
            onChange={(val) => {
              setActionFilter(val);
              setCurrentPage(1);
            }}
            options={[
              { value: 'ALL', label: 'All Actions' },
              { value: 'OT_APPROVED', label: 'OT Approved' },
              { value: 'OT_REJECTED', label: 'OT Rejected' },
              { value: 'EXPENSE_APPROVED', label: 'Expense Approved' },
              { value: 'EXPENSE_REJECTED', label: 'Expense Rejected' },
              { value: 'EMPLOYEE_IMPORT_COMPLETED', label: 'Employee Import' },
              { value: 'EMPLOYEE_CREATED', label: 'Employee Created' },
              { value: 'EMPLOYEE_UPDATED', label: 'Employee Updated' },
              { value: 'EMPLOYEE_DELETED', label: 'Employee Deleted' },
            ]}
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <TableSkeleton columns={5} rows={10} />
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs">
            <History className="h-10 w-10 text-slate-300 mx-auto mb-2" />
            <h3 className="font-semibold text-slate-700">No audit log entries found</h3>
            <p className="mt-1">Try clearing your filters or search query.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Timestamp</th>
                  <th className="px-4 py-3.5">Actor</th>
                  <th className="px-4 py-3.5">Action</th>
                  <th className="px-4 py-3.5">Entity</th>
                  <th className="px-4 py-3.5">Full Audit Details</th>
                  <th className="px-4 py-3.5 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {logs.map((log) => {
                  const detailText = log.afterData || log.beforeData || '—';
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap text-[11px]">
                        {formatDateTimeDisplay(log.timestamp)}
                      </td>
                      <td className="px-4 py-3.5 font-sans">
                        <div className="font-semibold text-slate-900">{log.actorName || 'System'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{log.actorEmail || 'daemon'}</div>
                      </td>
                      <td className="px-4 py-3.5 font-sans">
                        <span className="inline-block px-2.5 py-0.5 rounded font-mono font-semibold text-[10px] bg-slate-100 text-slate-800 border border-slate-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-sans">
                        <div className="font-medium text-slate-800">{log.entityType}</div>
                        <div className="text-[10px] text-slate-400 font-mono break-all max-w-[120px]">{log.entityId}</div>
                      </td>
                      <td className="px-4 py-3.5 text-[11px] text-slate-700 font-mono whitespace-pre-wrap break-all max-w-md">
                        {detailText}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-[11px] font-sans font-semibold border border-slate-200 transition-colors"
                          title="View Full JSON Details"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

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

      {/* Full Details Modal Inspector */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in overflow-y-auto">
          <div className="relative my-auto bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 flex-shrink-0">
              <div className="flex items-center gap-2">
                <FileJson className="h-5 w-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Audit Log Inspector: {selectedLog.action}
                  </h3>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {formatDateTimeDisplay(selectedLog.timestamp)} • Entity ID: {selectedLog.entityId}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              {selectedLog.beforeData && (
                <div>
                  <div className="flex items-center justify-between text-slate-700 font-semibold mb-1">
                    <span>Before Data State:</span>
                    <button
                      onClick={() => handleCopyJson(selectedLog.beforeData!)}
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      Copy JSON
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {formatJsonPayload(selectedLog.beforeData)}
                  </pre>
                </div>
              )}

              {selectedLog.afterData && (
                <div>
                  <div className="flex items-center justify-between text-slate-700 font-semibold mb-1">
                    <span>After Data Payload / Action Summary:</span>
                    <button
                      onClick={() => handleCopyJson(selectedLog.afterData!)}
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700"
                    >
                      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      Copy JSON
                    </button>
                  </div>
                  <pre className="p-3 bg-slate-900 text-blue-300 rounded-xl font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                    {formatJsonPayload(selectedLog.afterData)}
                  </pre>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t flex-shrink-0">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
