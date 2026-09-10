import {
  CalculateOTInput,
  CalculateOTResult,
  CalculationSnapshot,
  OTRuleConfig,
} from './types';
import {
  applyRounding,
  DEFAULT_OT_RULE_CONFIG,
  isSundayDate,
  timeStringToMinutes,
} from './rules';

/**
 * Authoritative, pure backend OT Calculation Engine.
 * 
 * Rules:
 * - Deterministic, unit-tested, and timezone-aware.
 * - ZERO database or UI dependencies.
 * - Retains raw duration, rounded raw hours, multiplier, and payable hours.
 * - Generates an immutable, transparent calculation trace.
 */
export function calculateOT(input: CalculateOTInput): CalculateOTResult {
  const { workDate, startTime, endTime, shift, holidays = [], ruleConfig = {} } = input;

  const config: OTRuleConfig = {
    ...DEFAULT_OT_RULE_CONFIG,
    ...ruleConfig,
  };

  const shiftStartMin = timeStringToMinutes(shift.startTime);
  let shiftEndMin = timeStringToMinutes(shift.endTime);
  let otBoundaryMin = timeStringToMinutes(shift.regularOtStartTime);

  // If shift crosses midnight (e.g. 23:00 to 07:00), normalize end and boundary to relative offset
  if (shift.crossesMidnight || shiftEndMin < shiftStartMin) {
    if (shiftEndMin < shiftStartMin) {
      shiftEndMin += 1440;
    }
    if (otBoundaryMin < shiftStartMin) {
      otBoundaryMin += 1440;
    }
  }

  const actualStartMin = timeStringToMinutes(startTime);
  let actualEndMin = timeStringToMinutes(endTime);

  // Normalize actual times relative to work date
  // If actual start is within the shift start window (or night shift crossing),
  // check if actual end wrapped around past midnight.
  let normalizedActualStart = actualStartMin;
  let normalizedActualEnd = actualEndMin;

  if (shift.crossesMidnight) {
    // Night shift starts around 23:00
    if (normalizedActualStart < 720) {
      // If someone logged 00:00 as start for a night shift belonging to yesterday's date
      normalizedActualStart += 1440;
    }
    if (normalizedActualEnd < normalizedActualStart || normalizedActualEnd <= 720) {
      normalizedActualEnd += 1440;
    }
  } else {
    // Day/afternoon shifts
    if (normalizedActualEnd < normalizedActualStart) {
      normalizedActualEnd += 1440;
    }
  }

  // Calculate OT minutes: time worked beyond the regular OT start boundary
  let otStartMin = Math.max(normalizedActualStart, otBoundaryMin);
  let rawOtMinutes = Math.max(0, normalizedActualEnd - otStartMin);

  // Validate edge condition: if actual work ended before OT boundary, OT is 0
  if (normalizedActualEnd <= otBoundaryMin || normalizedActualStart >= normalizedActualEnd) {
    rawOtMinutes = 0;
  }

  // Check if minimum OT threshold applies
  if (config.minOtMinutes && rawOtMinutes < config.minOtMinutes) {
    rawOtMinutes = 0;
  }

  const rawHours = Math.round((rawOtMinutes / 60) * 100) / 100;
  const roundedRawHours = applyRounding(rawHours, config.roundingPolicy);

  // Check for Sunday & Holiday
  const isSunday = isSundayDate(workDate);
  const matchingHoliday = holidays.find((h) => h.active && h.date === workDate);
  const isHoliday = !!matchingHoliday;
  const holidayName = matchingHoliday?.name;

  // Determine multiplier
  let multiplier = config.weekdayMultiplier;
  if (isSunday || isHoliday) {
    // Multiplier for weekend/holiday (default 1.25x)
    multiplier = Math.max(
      isSunday ? config.sundayMultiplier : 1.0,
      isHoliday ? config.holidayMultiplier : 1.0
    );
  }

  // Calculate final payable hours
  // Apply multiplier to rounded raw hours (or raw hours if EXACT)
  const payableHours = Math.round(roundedRawHours * multiplier * 100) / 100;

  // Build immutable snapshot
  const snapshot: CalculationSnapshot = {
    workDate,
    startTime,
    endTime,
    shiftCode: shift.code,
    shiftName: shift.name,
    scheduledStart: shift.startTime,
    scheduledEnd: shift.endTime,
    otBoundary: shift.regularOtStartTime,
    rawDurationMinutes: rawOtMinutes,
    rawHours,
    roundedRawHours,
    roundingPolicy: config.roundingPolicy,
    isSunday,
    isHoliday,
    holidayName,
    multiplier,
    payableHours,
    ruleVersion: config.version,
    shiftVersion: shift.version,
    calculatedAt: new Date().toISOString(),
  };

  // Build human-readable explanation trace
  const dayTypeDesc = isHoliday
    ? `Holiday (${holidayName})`
    : isSunday
    ? 'Sunday'
    : 'Regular Working Day';

  const explanation = [
    `Shift: ${shift.name} (${shift.startTime} – ${shift.endTime})`,
    `Scheduled OT boundary: ${shift.regularOtStartTime}`,
    `Submitted interval: ${startTime} – ${endTime}`,
    `Raw OT: ${rawHours.toFixed(2)}h (${rawOtMinutes} mins beyond boundary)`,
    config.roundingPolicy !== 'EXACT' && roundedRawHours !== rawHours
      ? `Rounding applied (${config.roundingPolicy}): ${roundedRawHours.toFixed(2)}h`
      : null,
    `Day classification: ${dayTypeDesc} (Multiplier: ${multiplier.toFixed(2)}×)`,
    `Final Payable OT: ${payableHours.toFixed(2)} hours`,
  ]
    .filter(Boolean)
    .join(' | ');

  return {
    rawHours,
    payableHours,
    multiplier,
    isSunday,
    isHoliday,
    holidayName,
    ruleVersion: config.version,
    shiftVersion: shift.version,
    snapshot,
    explanation,
  };
}
