import * as XLSX from 'xlsx';
import { z } from 'zod';

export const EmployeeImportRowSchema = z.object({
  employeeCode: z.string().min(1, 'Employee code is required').trim(),
  fullName: z.string().min(1, 'Employee name is required').trim(),
  email: z.string().email('Invalid email address').trim().toLowerCase(),
  department: z.string().optional().default('General'),
  shiftCode: z.string().min(1, 'Shift is required').trim().toUpperCase(),
});

export type EmployeeImportRow = z.infer<typeof EmployeeImportRowSchema>;

export interface ParsedRowResult {
  rowNumber: number;
  data: Partial<EmployeeImportRow>;
  isValid: boolean;
  isDuplicate: boolean;
  errors: string[];
}

export interface ImportPreviewResult {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  rows: ParsedRowResult[];
}

/**
 * Normalizes header keys from Excel columns:
 * e.g. "Employee Code" -> "employeeCode", "Email" -> "email"
 */
function normalizeRowKeys(rawRow: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rawRow)) {
    const k = key.toLowerCase().trim().replace(/[^a-z0-9]/g, '');

    if (k.includes('code') || k === 'empcode' || k === 'id') {
      normalized.employeeCode = value;
    } else if (k.includes('name')) {
      normalized.fullName = value;
    } else if (k.includes('mail')) {
      normalized.email = value;
    } else if (k.includes('dept') || k.includes('department')) {
      normalized.department = value;
    } else if (k.includes('shift')) {
      normalized.shiftCode = value;
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Parses and validates an uploaded employee spreadsheet (XLSX, XLS, CSV)
 */
export function parseEmployeeSpreadsheet(
  buffer: Buffer,
  knownShiftCodes: string[] = ['FIRST', 'GENERAL', 'SECOND', 'NIGHT']
): ImportPreviewResult {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('Workbook contains no sheets.');
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: '',
  });

  const parsedRows: ParsedRowResult[] = [];
  const seenCodes = new Set<string>();
  const seenEmails = new Set<string>();

  const upperKnownShifts = knownShiftCodes.map((s) => s.toUpperCase());

  for (let idx = 0; idx < rawRows.length; idx++) {
    const raw = rawRows[idx];
    const rowNumber = idx + 2; // +1 for 1-based index, +1 for header row

    // Skip completely empty rows
    const values = Object.values(raw).map((v) => String(v).trim());
    if (values.every((v) => v === '')) {
      continue;
    }

    const normalized = normalizeRowKeys(raw);

    const validation = EmployeeImportRowSchema.safeParse(normalized);
    const errors: string[] = [];
    let isDuplicate = false;

    if (!validation.success) {
      errors.push(...validation.error.issues.map((i) => i.message));
    } else {
      const { employeeCode, email, shiftCode } = validation.data;

      // Duplicate check within sheet
      if (seenCodes.has(employeeCode)) {
        errors.push(`Duplicate Employee Code "${employeeCode}" in sheet.`);
        isDuplicate = true;
      } else {
        seenCodes.add(employeeCode);
      }

      if (seenEmails.has(email)) {
        errors.push(`Duplicate Email "${email}" in sheet.`);
        isDuplicate = true;
      } else {
        seenEmails.add(email);
      }

      // Check if shift matches known shifts
      if (!upperKnownShifts.includes(shiftCode)) {
        errors.push(
          `Unknown shift "${shiftCode}". Available shifts: ${upperKnownShifts.join(', ')}`
        );
      }
    }

    parsedRows.push({
      rowNumber,
      data: validation.success ? validation.data : (normalized as Partial<EmployeeImportRow>),
      isValid: errors.length === 0,
      isDuplicate,
      errors,
    });
  }

  const validCount = parsedRows.filter((r) => r.isValid).length;
  const duplicateCount = parsedRows.filter((r) => r.isDuplicate).length;
  const invalidCount = parsedRows.length - validCount;

  return {
    totalRows: parsedRows.length,
    validCount,
    invalidCount,
    duplicateCount,
    rows: parsedRows,
  };
}
