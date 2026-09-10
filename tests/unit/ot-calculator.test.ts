import { describe, it, expect } from 'vitest';
import { calculateOT } from '@/domain/ot/calculator';
import { DEFAULT_SHIFTS, detectShiftFromStartTime } from '@/domain/ot/rules';
import { HolidayDefinition } from '@/domain/ot/types';

describe('OT Calculation Engine - PRD Golden Test Suite', () => {
  const sampleHoliday: HolidayDefinition = {
    id: 'hol_1',
    date: '2026-08-15',
    name: 'Independence Day',
    type: 'NATIONAL_HOLIDAY',
    active: true,
  };

  // 2026-09-08 is a Tuesday (Weekday)
  const weekday = '2026-09-08';
  // 2026-09-13 is a Sunday
  const sunday = '2026-09-13';
  // 2026-08-15 is Independence Day (Saturday)
  const holidayDate = '2026-08-15';

  it('Test 1 — First Shift (07:00 → 19:00) yields 4.00h OT', () => {
    const result = calculateOT({
      workDate: weekday,
      startTime: '07:00',
      endTime: '19:00',
      shift: DEFAULT_SHIFTS.FIRST,
      ruleConfig: { roundingPolicy: 'EXACT' },
    });

    expect(result.rawHours).toBe(4.0);
    expect(result.multiplier).toBe(1.0);
    expect(result.payableHours).toBe(4.0);
    expect(result.isSunday).toBe(false);
    expect(result.isHoliday).toBe(false);
  });

  it('Test 2 — Sunday First Shift (07:00 → 19:00) yields raw 4h, 1.25x multiplier, payable 5.00h', () => {
    const result = calculateOT({
      workDate: sunday,
      startTime: '07:00',
      endTime: '19:00',
      shift: DEFAULT_SHIFTS.FIRST,
      ruleConfig: { roundingPolicy: 'EXACT' },
    });

    expect(result.rawHours).toBe(4.0);
    expect(result.multiplier).toBe(1.25);
    expect(result.payableHours).toBe(5.0);
    expect(result.isSunday).toBe(true);
    expect(result.isHoliday).toBe(false);
  });

  it('Test 3 — General Shift (08:30 → 20:30) yields 3.00h payable OT with configured policy', () => {
    const result = calculateOT({
      workDate: weekday,
      startTime: '08:30',
      endTime: '20:30',
      shift: DEFAULT_SHIFTS.GENERAL, // regularOtStartTime is 17:30
      ruleConfig: { roundingPolicy: 'EXACT' },
    });

    expect(result.rawHours).toBe(3.0);
    expect(result.payableHours).toBe(3.0);
    expect(result.multiplier).toBe(1.0);
  });

  it('Test 3b — General Shift with 18:00 OT start and UP_TO_NEXT_1_HOUR rounding yields raw 2.5h and payable 3.0h', () => {
    const customGeneralShift = {
      ...DEFAULT_SHIFTS.GENERAL,
      regularOtStartTime: '18:00',
    };

    const result = calculateOT({
      workDate: weekday,
      startTime: '08:30',
      endTime: '20:30',
      shift: customGeneralShift,
      ruleConfig: { roundingPolicy: 'UP_TO_NEXT_1_HOUR' },
    });

    expect(result.rawHours).toBe(2.5);
    expect(result.snapshot.roundedRawHours).toBe(3.0);
    expect(result.payableHours).toBe(3.0);
  });

  it('Test 4 — Second Shift (15:00 → 01:00) crossing midnight yields 2.00h OT', () => {
    const result = calculateOT({
      workDate: weekday,
      startTime: '15:00',
      endTime: '01:00',
      shift: DEFAULT_SHIFTS.SECOND,
      ruleConfig: { roundingPolicy: 'EXACT' },
    });

    expect(result.rawHours).toBe(2.0);
    expect(result.payableHours).toBe(2.0);
  });

  it('Test 5 — Night Shift (23:00 → 10:00) crossing midnight yields 3.00h OT', () => {
    const result = calculateOT({
      workDate: weekday,
      startTime: '23:00',
      endTime: '10:00',
      shift: DEFAULT_SHIFTS.NIGHT,
      ruleConfig: { roundingPolicy: 'EXACT' },
    });

    expect(result.rawHours).toBe(3.0);
    expect(result.payableHours).toBe(3.0);
  });

  it('Test 6 — Holiday First Shift (07:00 → 19:00) yields 4 × 1.25 = 5.00h OT', () => {
    const result = calculateOT({
      workDate: holidayDate,
      startTime: '07:00',
      endTime: '19:00',
      shift: DEFAULT_SHIFTS.FIRST,
      holidays: [sampleHoliday],
      ruleConfig: { roundingPolicy: 'EXACT' },
    });

    expect(result.rawHours).toBe(4.0);
    expect(result.multiplier).toBe(1.25);
    expect(result.payableHours).toBe(5.0);
    expect(result.isHoliday).toBe(true);
    expect(result.holidayName).toBe('Independence Day');
  });

  it('Edge Case: Normal shift ending at or before regular OT boundary yields 0.00h OT', () => {
    const result = calculateOT({
      workDate: weekday,
      startTime: '07:00',
      endTime: '15:00',
      shift: DEFAULT_SHIFTS.FIRST,
    });

    expect(result.rawHours).toBe(0);
    expect(result.payableHours).toBe(0);
  });

  it('Edge Case: Calculation snapshot contains transparent trace', () => {
    const result = calculateOT({
      workDate: sunday,
      startTime: '07:00',
      endTime: '19:00',
      shift: DEFAULT_SHIFTS.FIRST,
    });

    expect(result.explanation).toContain('Sunday');
    expect(result.explanation).toContain('1.25×');
    expect(result.snapshot.ruleVersion).toBeDefined();
    expect(result.snapshot.shiftVersion).toBeDefined();
  });

  it('Dynamic Shift Detection: Shifts are not mandatory and detect automatically from timing', () => {
    // 07:00 start -> First Shift -> 07:00 to 19:00 yields 4.0h
    const shift7am = detectShiftFromStartTime('07:00');
    expect(shift7am.code).toBe('FIRST');
    const res7am = calculateOT({
      workDate: weekday,
      startTime: '07:00',
      endTime: '19:00',
      shift: shift7am,
    });
    expect(res7am.payableHours).toBe(4.0);

    // 08:30 start -> General Shift -> 08:30 to 20:30 yields 3.0h
    const shift830am = detectShiftFromStartTime('08:30');
    expect(shift830am.code).toBe('GENERAL');
    const res830am = calculateOT({
      workDate: weekday,
      startTime: '08:30',
      endTime: '20:30',
      shift: shift830am,
    });
    expect(res830am.payableHours).toBe(3.0);
  });
});
