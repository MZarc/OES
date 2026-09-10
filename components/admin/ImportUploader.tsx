'use client';

import { useState } from 'react';
import { previewEmployeeImportAction, executeEmployeeImportAction } from '@/app/actions/employees';
import { Upload, FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/Toast';
import { Pagination } from '@/components/ui/Pagination';

export function ImportUploader() {
  const router = useRouter();
  const toast = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [previewData, setPreviewData] = useState<{
    filename: string;
    fileHash: string;
    preview: {
      totalRows: number;
      validCount: number;
      invalidCount: number;
      duplicateCount: number;
      rows: Array<{
        rowNumber: number;
        data: any;
        isValid: boolean;
        isDuplicate: boolean;
        errors: string[];
      }>;
    };
  } | null>(null);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || !e.target.files[0]) return;
    const selected = e.target.files[0];
    setFile(selected);
    setPreviewData(null);
    setCurrentPage(1);

    const formData = new FormData();
    formData.append('file', selected);

    setPreviewing(true);
    try {
      const data = await previewEmployeeImportAction(formData);
      setPreviewData(data);
      toast.info(`Workbook parsed: ${data.preview.validCount} valid rows ready for review.`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse employee spreadsheet.');
    } finally {
      setPreviewing(false);
    }
  }

  async function handleConfirmImport() {
    if (!previewData) return;
    setImporting(true);

    const validRows = previewData.preview.rows
      .filter((r) => r.isValid)
      .map((r) => ({
        employeeCode: r.data.employeeCode,
        fullName: r.data.fullName,
        email: r.data.email,
        department: r.data.department,
        shiftCode: r.data.shiftCode,
      }));

    try {
      const res = await executeEmployeeImportAction({
        filename: previewData.filename,
        fileHash: previewData.fileHash,
        rows: validRows,
      });

      toast.success(`Batch imported successfully! Created ${res.successCount} employee accounts and queued invitation emails.`);

      setTimeout(() => {
        router.refresh();
        setImporting(false);
      }, 2000);
    } catch (err: any) {
      toast.error(err.message || 'Error executing employee import batch.');
      setImporting(false);
    }
  }

  const paginatedRows = previewData
    ? previewData.preview.rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)
    : [];
  const totalPages = previewData ? Math.ceil(previewData.preview.rows.length / pageSize) || 1 : 1;

  return (
    <div className="space-y-6">
      {/* Upload Box */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <FileSpreadsheet className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="text-base font-bold text-slate-900">Bulk Employee Spreadsheet Import</h2>
            <p className="text-xs text-slate-500">
              Upload .xlsx, .xls or .csv formatted employee spreadsheets.
            </p>
          </div>
        </div>

        <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
          <Upload className="h-8 w-8 text-blue-600 mb-2" />
          <span className="text-sm font-semibold text-slate-800">
            {previewing ? 'Parsing workbook...' : file ? file.name : 'Choose Excel / CSV File'}
          </span>
          <span className="text-xs text-slate-500 mt-1">
            Columns: Employee Code, Employee Name, Email, Department, Shift
          </span>
          <input
            type="file"
            accept=".xlsx, .xls, .csv"
            disabled={previewing || importing}
            onChange={handleFileSelected}
            className="hidden"
          />
        </label>
      </div>

      {/* Preview Table & Validation Diagnostics */}
      {previewData && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Import Validation Preview</h3>
              <p className="text-xs text-slate-500">Review validation diagnostics before confirming database commit.</p>
            </div>

            <button
              onClick={handleConfirmImport}
              disabled={importing || previewData.preview.validCount === 0}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Importing Employees...
                </>
              ) : (
                `Confirm Import (${previewData.preview.validCount} Valid Rows)`
              )}
            </button>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
            <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
              <div className="text-slate-500">Total Rows</div>
              <div className="text-base font-bold text-slate-900">
                {previewData.preview.totalRows}
              </div>
            </div>
            <div className="bg-emerald-50 p-2.5 rounded border border-emerald-200 text-emerald-800">
              <div>Valid Rows</div>
              <div className="text-base font-bold">{previewData.preview.validCount}</div>
            </div>
            <div className="bg-amber-50 p-2.5 rounded border border-amber-200 text-amber-800">
              <div>Duplicates / Conflicts</div>
              <div className="text-base font-bold">
                {previewData.preview.duplicateCount + ((previewData.preview as any).conflictCount || 0)}
              </div>
            </div>
            <div className="bg-red-50 p-2.5 rounded border border-red-200 text-red-800">
              <div>Invalid Rows</div>
              <div className="text-base font-bold">{previewData.preview.invalidCount}</div>
            </div>
          </div>

          {(previewData.preview as any).conflictCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <span>
                <strong>System Conflict Warning:</strong> {(previewData.preview as any).conflictCount} row(s) match existing or previously deactivated employees. Conflicts are flagged below and cannot be imported without resolving.
              </span>
            </div>
          )}

          {/* Rows List */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b text-slate-500 font-semibold uppercase">
                <tr>
                  <th className="p-2">Row</th>
                  <th className="p-2">Code</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Shift</th>
                  <th className="p-2">Status & Errors</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedRows.map((r) => (
                  <tr key={r.rowNumber} className={r.isValid ? 'bg-white' : 'bg-red-50/50'}>
                    <td className="p-2 text-slate-400 font-mono">#{r.rowNumber}</td>
                    <td className="p-2 font-mono font-semibold">{r.data.employeeCode}</td>
                    <td className="p-2">{r.data.fullName}</td>
                    <td className="p-2">{r.data.email}</td>
                    <td className="p-2 font-mono">{r.data.shiftCode}</td>
                    <td className="p-2">
                      {r.isValid ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Valid
                        </span>
                      ) : (
                        <div className="space-y-1">
                          {r.errors.map((err, i) => (
                            <span
                              key={i}
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-medium mr-1 ${
                                err.toLowerCase().includes('conflict') || err.toLowerCase().includes('deleted')
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200 font-semibold'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {err}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalRecords={previewData.preview.rows.length}
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
    </div>
  );
}
