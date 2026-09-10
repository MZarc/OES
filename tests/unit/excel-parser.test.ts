import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { parseEmployeeSpreadsheet } from '@/lib/excel/parser';

describe('Excel Employee Importer', () => {
  it('Successfully parses valid spreadsheet rows', () => {
    const rows = [
      {
        'Employee Code': 'EMP001',
        'Employee Name': 'Rahul Patel',
        Email: 'rahul@example.com',
        Department: 'Production',
        Shift: 'First',
      },
      {
        'Employee Code': 'EMP002',
        'Employee Name': 'Priya Shah',
        Email: 'priya@example.com',
        Department: 'Accounts',
        Shift: 'General',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = parseEmployeeSpreadsheet(buffer, ['FIRST', 'GENERAL', 'SECOND', 'NIGHT']);

    expect(result.totalRows).toBe(2);
    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(0);
    expect(result.rows[0].data.employeeCode).toBe('EMP001');
    expect(result.rows[1].data.fullName).toBe('Priya Shah');
  });

  it('Detects duplicate employee codes and invalid emails', () => {
    const rows = [
      {
        'Employee Code': 'EMP001',
        'Employee Name': 'User One',
        Email: 'one@example.com',
        Shift: 'First',
      },
      {
        'Employee Code': 'EMP001', // Duplicate code
        'Employee Name': 'User Two',
        Email: 'two-not-an-email', // Invalid email
        Shift: 'UnknownShift',     // Unknown shift
      },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = parseEmployeeSpreadsheet(buffer, ['FIRST', 'GENERAL']);

    expect(result.totalRows).toBe(2);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(1);
    expect(result.rows[1].isValid).toBe(false);
    expect(result.rows[1].errors.length).toBeGreaterThan(0);
  });

  it('PRD Acceptance Test 6: Parses and validates the 250-employee bulk roster', () => {
    const filePath = path.resolve(__dirname, '../../demo_employees_250.xlsx');
    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const result = parseEmployeeSpreadsheet(buffer, ['FIRST', 'GENERAL', 'SECOND', 'NIGHT']);

      expect(result.totalRows).toBe(250);
      expect(result.validCount).toBe(250);
      expect(result.invalidCount).toBe(0);
      expect(result.duplicateCount).toBe(0);
    }
  });
});
