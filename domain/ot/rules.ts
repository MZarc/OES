import { RoundingPolicy, ShiftDefinition, OTRuleConfig } from './types';

/**
 * Parses "HH:mm" time string into total minutes from 00:00 (0..1439).
 */
export function timeStringToMinutes(timeStr: string): number {
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) {
    throw new Error(`Invalid time format "${timeStr}". Expected HH:mm.`);
  }
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);

  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error(`Invalid time values in "${timeStr}". Hours must be 0-23 and minutes 0-59.`);
  }

  return hours * 60 + minutes;
}

/**
 * Formats minutes from 00:00 back into "HH:mm".
 */
export function minutesToTimeString(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

/**
 * Applies configured rounding policy to duration in hours.
 */
export function applyRounding(hours: number, policy: RoundingPolicy): number {
  if (hours <= 0) return 0;

  switch (policy) {
    case 'EXACT':
      return Math.round(hours * 100) / 100;

    case 'UP_TO_NEXT_15_MINUTES': {
      // 15 mins = 0.25h
      return Math.ceil(hours * 4) / 4;
    }

    case 'UP_TO_NEXT_30_MINUTES': {
      // 30 mins = 0.5h
      return Math.ceil(hours * 2) / 2;
    }

    case 'UP_TO_NEXT_1_HOUR': {
      return Math.ceil(hours);
    }

    case 'NEAREST_15_MINUTES': {
      return Math.round(hours * 4) / 4;
    }

    case 'NEAREST_30_MINUTES': {
      return Math.round(hours * 2) / 2;
    }

    default:
      return Math.round(hours * 100) / 100;
  }
}

/**
 * Checks if a date (YYYY-MM-DD) falls on a Sunday.
 * Uses ISO date representation without local timezone shift bugs.
 */
export function isSundayDate(dateStr: string): boolean {
  const [year, month, day] = dateStr.split('-').map((s) => parseInt(s, 10));
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCDay() === 0;
}

/**
 * Initial Default System Shifts (matching PRD & user comments)
 */
export const DEFAULT_SHIFTS: Record<string, ShiftDefinition> = {
  FIRST: {
    id: 'shift_first_v1',
    code: 'FIRST',
    name: 'First Shift',
    startTime: '07:00',
    endTime: '15:00',
    regularOtStartTime: '15:00',
    crossesMidnight: false,
    version: '2026-v1',
  },
  GENERAL: {
    id: 'shift_general_v1',
    code: 'GENERAL',
    name: 'General Shift',
    startTime: '08:30',
    endTime: '17:15',
    // Configured with buffer; working until 20:30 yields 3.0h under UP_TO_NEXT_1_HOUR or 17:30 boundary
    regularOtStartTime: '17:30',
    crossesMidnight: false,
    version: '2026-v1',
  },
  SECOND: {
    id: 'shift_second_v1',
    code: 'SECOND',
    name: 'Second Shift',
    startTime: '15:00',
    endTime: '23:00',
    regularOtStartTime: '23:00',
    crossesMidnight: false,
    version: '2026-v1',
  },
  NIGHT: {
    id: 'shift_night_v1',
    code: 'NIGHT',
    name: 'Night Shift',
    startTime: '23:00',
    endTime: '07:00',
    regularOtStartTime: '07:00',
    crossesMidnight: true,
    version: '2026-v1',
  },
};

/**
 * Automatically detects the most appropriate shift based on the work start time.
 * PRD: Shifts are not mandatory per employee; timing drives the shift detection.
 */
export function detectShiftFromStartTime(
  startTime: string,
  candidateShifts: ShiftDefinition[] = Object.values(DEFAULT_SHIFTS)
): ShiftDefinition {
  const startMin = timeStringToMinutes(startTime);

  let bestShift = candidateShifts[0] || DEFAULT_SHIFTS.GENERAL;
  let minDiff = Infinity;

  for (const shift of candidateShifts) {
    const shiftStartMin = timeStringToMinutes(shift.startTime);
    let diff = Math.abs(startMin - shiftStartMin);
    if (diff > 720) {
      diff = 1440 - diff;
    }

    if (diff < minDiff) {
      minDiff = diff;
      bestShift = shift;
    }
  }

  return bestShift;
}

/**
 * Default OT Rule Configuration
 */
export const DEFAULT_OT_RULE_CONFIG: OTRuleConfig = {
  version: '2026-v1',
  weekdayMultiplier: 1.0,
  sundayMultiplier: 1.25,
  holidayMultiplier: 1.25,
  roundingPolicy: 'UP_TO_NEXT_1_HOUR',
  timezone: 'Asia/Kolkata',
  minOtMinutes: 0,
};
