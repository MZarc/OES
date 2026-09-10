export type RoundingPolicy = 
  | 'EXACT'
  | 'UP_TO_NEXT_15_MINUTES'
  | 'UP_TO_NEXT_30_MINUTES'
  | 'UP_TO_NEXT_1_HOUR'
  | 'NEAREST_15_MINUTES'
  | 'NEAREST_30_MINUTES';

export type ShiftCode = 'FIRST' | 'GENERAL' | 'SECOND' | 'NIGHT' | string;

export interface ShiftDefinition {
  id: string;
  code: ShiftCode;
  name: string;
  startTime: string; // "HH:mm" e.g. "07:00"
  endTime: string;   // "HH:mm" e.g. "15:00"
  regularOtStartTime: string; // "HH:mm" e.g. "15:00" or "18:00"
  crossesMidnight: boolean;
  version: string;
  activeFrom?: string;
  activeUntil?: string | null;
}

export interface HolidayDefinition {
  id: string;
  date: string; // "YYYY-MM-DD"
  name: string;
  type: 'COMPANY_HOLIDAY' | 'NATIONAL_HOLIDAY' | 'SPECIAL_HOLIDAY' | 'OPTIONAL_HOLIDAY' | string;
  active: boolean;
}

export interface OTRuleConfig {
  id?: string;
  version: string; // e.g. "2026-v1"
  weekdayMultiplier: number; // default 1.0
  sundayMultiplier: number;  // default 1.25
  holidayMultiplier: number; // default 1.25
  roundingPolicy: RoundingPolicy;
  timezone: string; // default "Asia/Kolkata"
  minOtMinutes?: number; // minimum OT threshold in minutes (e.g. 0 or 30)
}

export interface CalculateOTInput {
  employeeId?: string;
  workDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  shift: ShiftDefinition;
  holidays?: HolidayDefinition[];
  ruleConfig?: Partial<OTRuleConfig>;
}

export interface CalculationSnapshot {
  workDate: string;
  startTime: string;
  endTime: string;
  shiftCode: string;
  shiftName: string;
  scheduledStart: string;
  scheduledEnd: string;
  otBoundary: string;
  rawDurationMinutes: number;
  rawHours: number;
  roundedRawHours: number;
  roundingPolicy: RoundingPolicy;
  isSunday: boolean;
  isHoliday: boolean;
  holidayName?: string;
  multiplier: number;
  payableHours: number;
  ruleVersion: string;
  shiftVersion: string;
  calculatedAt: string;
}

export interface CalculateOTResult {
  rawHours: number;
  payableHours: number;
  multiplier: number;
  isSunday: boolean;
  isHoliday: boolean;
  holidayName?: string;
  ruleVersion: string;
  shiftVersion: string;
  snapshot: CalculationSnapshot;
  explanation: string;
}
