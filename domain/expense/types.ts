export type ExpenseCategory =
  | 'Travel'
  | 'Food'
  | 'Accommodation'
  | 'Transport'
  | 'Office Supplies'
  | 'Communication'
  | 'Medical'
  | 'Other';

export type ExpenseStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'NEEDS_INFORMATION';

export interface ExpenseAttachment {
  id: string;
  expenseId?: string;
  originalFilename: string;
  storageKey: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Hash: string;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  employeeId: string;
  expenseDate: string; // "YYYY-MM-DD"
  category: ExpenseCategory;
  amount: number;
  description: string;
  status: ExpenseStatus;
  isFlaggedDuplicate: boolean;
  duplicateReason?: string;
  submittedAt: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  rejectionReason?: string | null;
  attachments?: ExpenseAttachment[];
}

export interface DuplicateCheckInput {
  employeeId: string;
  expenseDate: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  existingExpenses: Array<{
    id: string;
    expenseDate: string;
    category: string;
    amount: number;
    description: string;
    status: string;
  }>;
}

export interface DuplicateCheckResult {
  isPossibleDuplicate: boolean;
  flagReason?: string;
  matchingExpenseId?: string;
}
