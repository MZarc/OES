'use client';

import { useState } from 'react';
import { submitExpenseAction } from '@/app/actions/expenses';
import { EXPENSE_CATEGORIES, ALLOWED_ATTACHMENT_EXTENSIONS, MAX_ATTACHMENT_SIZE_BYTES } from '@/domain/expense/rules';
import { Receipt, Upload, AlertTriangle, CheckCircle2, AlertCircle, Loader2, FileImage, Sparkles, X, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { useToast } from '@/components/ui/Toast';
import { CustomSelect } from '@/components/ui/CustomSelect';

async function compressImageToWebP(file: File, maxWidth = 1600, quality = 0.8): Promise<File> {
  if (file.type === 'application/pdf') return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const compressedFile = new File([blob], `${baseName}.webp`, {
            type: 'image/webp',
            lastModified: Date.now(),
          });
          resolve(compressedFile);
        },
        'image/webp',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
  });
}

export function ExpenseForm() {
  const router = useRouter();
  const toast = useToast();
  const today = new Date().toISOString().split('T')[0];

  const [expenseDate, setExpenseDate] = useState(today);
  const [category, setCategory] = useState('Travel');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  interface AttachmentPreview {
    file: File;
    previewUrl: string;
    isPdf: boolean;
    origSize: number;
  }

  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [compressing, setCompressing] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;
    const rawSelected = Array.from(e.target.files).slice(0, 5);

    for (const f of rawSelected) {
      if (f.size > MAX_ATTACHMENT_SIZE_BYTES) {
        toast.error(`File "${f.name}" exceeds 10 MB limit.`);
        return;
      }
      const ext = f.name.split('.').pop()?.toLowerCase();
      if (!ext || !ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
        toast.error(`File "${f.name}" unsupported format. Allowed: JPG, PNG, WEBP, PDF.`);
        return;
      }
    }

    setCompressing(true);
    const newItems: AttachmentPreview[] = [];

    for (const f of rawSelected) {
      const isPdf = f.type === 'application/pdf';
      const comp = await compressImageToWebP(f);
      const previewUrl = isPdf ? '' : URL.createObjectURL(comp);
      newItems.push({
        file: comp,
        previewUrl,
        isPdf,
        origSize: f.size,
      });
    }

    setAttachments((prev) => [...prev, ...newItems].slice(0, 5));
    setCompressing(false);
    toast.success(`Processed ${newItems.length} file(s) with WebP compression.`);
    // Reset file input value
    e.target.value = '';
  }

  function removeAttachment(indexToRemove: number) {
    setAttachments((prev) => {
      const item = prev[indexToRemove];
      if (item && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((_, idx) => idx !== indexToRemove);
    });
  }

  const origSizeSum = attachments.reduce((acc, curr) => acc + curr.origSize, 0);
  const compSizeSum = attachments.reduce((acc, curr) => acc + curr.file.size, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const formData = new FormData();
    formData.append('expenseDate', expenseDate);
    formData.append('category', category);
    formData.append('amount', amount);
    formData.append('description', description);

    for (const item of attachments) {
      formData.append('attachments', item.file);
    }

    try {
      const res = await submitExpenseAction(formData);

      if (res.isFlaggedDuplicate) {
        toast.warning(res.duplicateReason || 'Possible duplicate expense flagged for admin review.');
      }

      toast.success('Expense submitted successfully!');
      setTimeout(() => {
        router.push('/expenses/history');
      }, 1200);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit expense.');
      setSubmitting(false);
    }
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-xl mx-auto">
      <div className="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
        <Receipt className="h-6 w-6 text-blue-600" />
        <div>
          <h2 className="text-lg font-bold text-slate-900">Submit Expense</h2>
          <p className="text-xs text-slate-500">Attach receipt/invoice and provide business justification</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Amount (₹)
          </label>
          <div className="relative rounded-lg shadow-sm">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
              <span className="text-slate-500 font-bold">₹</span>
            </div>
            <input
              type="number"
              step="0.01"
              min="1"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-300 pl-8 pr-3.5 py-2.5 text-base font-semibold text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Category & Date */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Category
            </label>
            <CustomSelect
              size="md"
              className="w-full"
              value={category}
              onChange={(val) => setCategory(val)}
              options={EXPENSE_CATEGORIES.map((c) => ({
                value: c,
                label: c,
              }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Expense Date
            </label>
            <input
              type="date"
              required
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Description & Purpose
          </label>
          <textarea
            required
            rows={3}
            placeholder="e.g. Travel to client office in Pune for supplier audit"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Multi-File WebP Compressed Upload */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Receipt Files (Select multiple, auto-compressed to WebP)
          </label>
          
          <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
            {compressing ? (
              <div className="flex flex-col items-center text-blue-600 space-y-2">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="text-xs font-semibold">Compressing & Converting to WebP...</span>
              </div>
            ) : (
              <>
                <Upload className="h-7 w-7 text-blue-600 mb-2" />
                <span className="text-xs font-bold text-slate-800">
                  Click or drag files here to select multiple receipts
                </span>
                <span className="text-[11px] text-slate-400 mt-1">
                  Supports JPG, PNG, WebP, PDF (Max 5 files, up to 10MB each)
                </span>
              </>
            )}
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              disabled={compressing || submitting}
              className="hidden"
              onChange={handleFileChange}
            />
          </label>

          {attachments.length > 0 && (
            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3">
              <div className="flex items-center justify-between font-bold text-slate-800">
                <span className="flex items-center gap-1.5">
                  <FileImage className="h-4 w-4 text-emerald-600" />
                  {attachments.length} Receipt Attachment(s) Ready
                </span>
                {origSizeSum > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded font-mono">
                    <Sparkles className="h-3 w-3" />
                    WebP Compression: {formatBytes(origSizeSum)} → {formatBytes(compSizeSum)}
                  </span>
                )}
              </div>

              {/* Visual Thumbnail Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {attachments.map((item, i) => (
                  <div
                    key={i}
                    className="relative flex items-center gap-3 p-2 bg-white rounded-xl border border-slate-200 shadow-2xs group hover:border-blue-300 transition-colors"
                  >
                    {item.isPdf ? (
                      <div className="h-14 w-14 rounded-lg bg-rose-50 text-rose-600 flex flex-col items-center justify-center border border-rose-200 flex-shrink-0">
                        <FileText className="h-6 w-6" />
                        <span className="text-[9px] font-bold mt-0.5">PDF</span>
                      </div>
                    ) : (
                      <div className="relative h-14 w-14 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 bg-slate-100">
                        <img
                          src={item.previewUrl}
                          alt={item.file.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 pr-6">
                      <p className="text-xs font-semibold text-slate-800 truncate" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] font-mono text-slate-500">{formatBytes(item.file.size)}</span>
                        {!item.isPdf && (
                          <span className="text-[9px] px-1.5 py-0.2 bg-blue-50 text-blue-700 font-semibold rounded">
                            WebP
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="absolute right-2 top-2 p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Remove attachment"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={submitting || compressing}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Submitting Expense Claim...</span>
            </>
          ) : (
            <span>Submit Expense Claim</span>
          )}
        </button>
      </form>
    </div>
  );
}
