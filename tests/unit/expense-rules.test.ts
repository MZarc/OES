import { describe, it, expect } from 'vitest';
import { checkDuplicateExpense } from '@/domain/expense/duplicates';
import { validateAttachmentConstraints } from '@/domain/expense/rules';

describe('Expense Rules & Duplicate Detection', () => {
  it('Flags duplicate when same date, category, and amount exist', () => {
    const existing = [
      {
        id: 'exp_01',
        expenseDate: '2026-09-07',
        category: 'Travel',
        amount: 850,
        description: 'Travel to client site',
        status: 'SUBMITTED',
      },
    ];

    const result = checkDuplicateExpense({
      employeeId: 'EMP001',
      expenseDate: '2026-09-07',
      category: 'Travel',
      amount: 850,
      description: 'Cab fare to client',
      existingExpenses: existing,
    });

    expect(result.isPossibleDuplicate).toBe(true);
    expect(result.matchingExpenseId).toBe('exp_01');
    expect(result.flagReason).toContain('Identical amount (₹850)');
  });

  it('Does not flag duplicate when expense is on different date and non-overlapping description', () => {
    const existing = [
      {
        id: 'exp_01',
        expenseDate: '2026-09-01',
        category: 'Food',
        amount: 350,
        description: 'Team lunch',
        status: 'APPROVED',
      },
    ];

    const result = checkDuplicateExpense({
      employeeId: 'EMP001',
      expenseDate: '2026-09-08',
      category: 'Food',
      amount: 450,
      description: 'Client dinner',
      existingExpenses: existing,
    });

    expect(result.isPossibleDuplicate).toBe(false);
  });

  it('Validates attachment constraints: rejects invalid extensions and oversize files', () => {
    const validFiles = [
      { name: 'receipt.jpg', size: 1024 * 1024, type: 'image/jpeg' },
      { name: 'invoice.pdf', size: 2 * 1024 * 1024, type: 'application/pdf' },
    ];
    expect(validateAttachmentConstraints(validFiles).valid).toBe(true);

    const oversized = [
      { name: 'big.png', size: 12 * 1024 * 1024, type: 'image/png' },
    ];
    const overRes = validateAttachmentConstraints(oversized);
    expect(overRes.valid).toBe(false);
    expect(overRes.error).toContain('exceeds the maximum 10 MB size limit');

    const invalidExt = [
      { name: 'malware.exe', size: 500, type: 'application/octet-stream' },
    ];
    const extRes = validateAttachmentConstraints(invalidExt);
    expect(extRes.valid).toBe(false);
    expect(extRes.error).toContain('unsupported format');
  });
});
