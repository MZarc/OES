import { ExpenseCategory } from './types';

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Travel',
  'Food',
  'Accommodation',
  'Transport',
  'Office Supplies',
  'Communication',
  'Medical',
  'Other',
];

export const ALLOWED_ATTACHMENT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'pdf'];

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_ATTACHMENTS_PER_EXPENSE = 5;

/**
 * Validates basic attachment constraints
 */
export function validateAttachmentConstraints(
  files: Array<{ name: string; size: number; type: string }>
): { valid: boolean; error?: string } {
  if (files.length > MAX_ATTACHMENTS_PER_EXPENSE) {
    return {
      valid: false,
      error: `Maximum ${MAX_ATTACHMENTS_PER_EXPENSE} attachments allowed per expense.`,
    };
  }

  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      return {
        valid: false,
        error: `File "${file.name}" exceeds the maximum 10 MB size limit.`,
      };
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_ATTACHMENT_EXTENSIONS.includes(ext)) {
      return {
        valid: false,
        error: `File "${file.name}" has an unsupported format. Allowed: JPG, PNG, WEBP, PDF.`,
      };
    }
  }

  return { valid: true };
}
