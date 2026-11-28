import type { WeeklyBackupSchedule } from '../types/recovery';

export const DAY_OF_WEEK_OPTIONS = [
  { value: 0, label: 'Sunday', shortLabel: 'Sun' },
  { value: 1, label: 'Monday', shortLabel: 'Mon' },
  { value: 2, label: 'Tuesday', shortLabel: 'Tue' },
  { value: 3, label: 'Wednesday', shortLabel: 'Wed' },
  { value: 4, label: 'Thursday', shortLabel: 'Thu' },
  { value: 5, label: 'Friday', shortLabel: 'Fri' },
  { value: 6, label: 'Saturday', shortLabel: 'Sat' },
] as const;

export const DEFAULT_WEEKLY_BACKUP_SCHEDULE: WeeklyBackupSchedule = {
  enabled: true,
  dayOfWeek: 5, // Friday
  timeOfDay: '17:00', // 5:00 PM local time
};

function parseTimeOfDay(timeOfDay: string): { hours: number; minutes: number } {
  const match = /^(\d{1,2}):(\d{2})$/.exec((timeOfDay || '').trim());
  if (!match) return { hours: 17, minutes: 0 };
  const hours = Math.min(23, Math.max(0, Number(match[1])));
  const minutes = Math.min(59, Math.max(0, Number(match[2])));
  return { hours, minutes };
}

function formatLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatTime12h(timeOfDay: string): string {
  const { hours, minutes } = parseTimeOfDay(timeOfDay);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hh12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(hh12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

export function getDayLabel(dayOfWeek: number): string {
  return (
    DAY_OF_WEEK_OPTIONS.find((d) => d.value === dayOfWeek)?.label ?? 'Friday'
  );
}

export interface WeeklyBackupSlotStatus {
  currentSlotDate: Date;
  currentSlotKey: string;
  nextScheduledDate: Date;
  nextScheduledLabel: string;
  isDueNow: boolean;
  isSnoozed: boolean;
  snoozedUntilLabel: string | null;
}

/**
 * Evaluates the current weekly backup slot against the active local system clock.
 */
export function evaluateWeeklyBackupSchedule(
  schedule: WeeklyBackupSchedule,
  now: Date = new Date(),
): WeeklyBackupSlotStatus {
  const targetDay =
    Number.isInteger(schedule.dayOfWeek) &&
    schedule.dayOfWeek >= 0 &&
    schedule.dayOfWeek <= 6
      ? schedule.dayOfWeek
      : 5;
  const { hours, minutes } = parseTimeOfDay(schedule.timeOfDay);

  // Build candidate slot for this calendar week
  const todayDow = now.getDay();
  const daysSinceTarget = (todayDow - targetDay + 7) % 7;

  const currentSlotDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - daysSinceTarget,
    hours,
    minutes,
    0,
    0,
  );

  // If today is the target day but scheduled time hasn't passed yet, the most recent due slot was 7 days ago
  if (currentSlotDate.getTime() > now.getTime()) {
    currentSlotDate.setDate(currentSlotDate.getDate() - 7);
  }

  const nextScheduledDate = new Date(currentSlotDate.getTime());
  nextScheduledDate.setDate(nextScheduledDate.getDate() + 7);

  const currentSlotKey = formatLocalDateKey(currentSlotDate);

  const nextDayShort = nextScheduledDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const nextScheduledLabel = `${nextDayShort} · ${formatTime12h(schedule.timeOfDay)}`;

  const snoozedUntilMs = schedule.snoozedUntilIso
    ? Date.parse(schedule.snoozedUntilIso)
    : NaN;
  const isSnoozed =
    Number.isFinite(snoozedUntilMs) && now.getTime() < snoozedUntilMs;
  const snoozedUntilLabel = isSnoozed
    ? new Date(snoozedUntilMs).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const lastBackupMs = schedule.lastBackupAtIso
    ? Date.parse(schedule.lastBackupAtIso)
    : NaN;
  const alreadyBackedUpForCurrentSlot =
    Number.isFinite(lastBackupMs) && lastBackupMs >= currentSlotDate.getTime();
  const alreadyPromptedForCurrentSlot =
    schedule.lastPromptedSlotKey === currentSlotKey;

  const isDueNow =
    Boolean(schedule.enabled) &&
    !isSnoozed &&
    !alreadyBackedUpForCurrentSlot &&
    !alreadyPromptedForCurrentSlot;

  return {
    currentSlotDate,
    currentSlotKey,
    nextScheduledDate,
    nextScheduledLabel,
    isDueNow,
    isSnoozed,
    snoozedUntilLabel,
  };
}
