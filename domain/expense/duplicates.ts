import { DuplicateCheckInput, DuplicateCheckResult } from './types';

/**
 * Calculates string similarity using simple Levenshtein / Dice coefficient
 * to evaluate similar descriptions without external heavy dependencies.
 */
function normalizeDescription(desc: string): string {
  return desc.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

function wordOverlapScore(a: string, b: string): number {
  const wordsA = new Set(normalizeDescription(a).split(/\s+/).filter(Boolean));
  const wordsB = new Set(normalizeDescription(b).split(/\s+/).filter(Boolean));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let common = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) common++;
  }
  return (2 * common) / (wordsA.size + wordsB.size);
}

/**
 * Deterministic Expense Duplicate Detection per PRD Section 25.
 * 
 * Flags potential duplicates when:
 * 1. Same employee, same date, same amount, same category.
 * 2. Or same employee, same amount, same category within a 3-day window with similar description.
 */
export function checkDuplicateExpense(input: DuplicateCheckInput): DuplicateCheckResult {
  const { expenseDate, category, amount, description, existingExpenses } = input;

  const targetDate = new Date(expenseDate).getTime();

  for (const exp of existingExpenses) {
    // Ignore rejected or draft expenses
    if (exp.status === 'REJECTED' || exp.status === 'DRAFT') {
      continue;
    }

    const expDate = new Date(exp.expenseDate).getTime();
    const daysDiff = Math.abs(targetDate - expDate) / (1000 * 60 * 60 * 24);

    // Exact Match: Same Date, Same Amount, Same Category
    if (daysDiff === 0 && exp.amount === amount && exp.category === category) {
      return {
        isPossibleDuplicate: true,
        matchingExpenseId: exp.id,
        flagReason: `Possible duplicate: Identical amount (₹${amount}) and category (${category}) submitted on ${exp.expenseDate}.`,
      };
    }

    // Near-Match: Within 3 days, same amount, high description similarity
    if (daysDiff <= 3 && exp.amount === amount) {
      const similarity = wordOverlapScore(description, exp.description);
      if (similarity >= 0.5) {
        return {
          isPossibleDuplicate: true,
          matchingExpenseId: exp.id,
          flagReason: `Possible duplicate: Similar expense (₹${amount}, "${exp.description}") submitted on ${exp.expenseDate}.`,
        };
      }
    }
  }

  return {
    isPossibleDuplicate: false,
  };
}
