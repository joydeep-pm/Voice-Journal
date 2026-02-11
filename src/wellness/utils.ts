import type { InterventionType, ReminderPreferences, StressCheckIn } from '@/src/db/types';

export function interventionLabel(type: InterventionType): string {
  if (type === 'breathing') {
    return 'Box breathing';
  }
  if (type === 'grounding') {
    return '5-4-3-2-1 grounding';
  }
  return 'Quick reframe';
}

export function gad2Severity(totalScore: number): string {
  if (totalScore >= 5) {
    return 'High symptoms';
  }
  if (totalScore >= 3) {
    return 'Moderate symptoms';
  }
  return 'Mild symptoms';
}

export function minuteOfDay(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

function inQuietHours(nowMin: number, prefs: ReminderPreferences): boolean {
  if (prefs.quietStartMin === prefs.quietEndMin) {
    return false;
  }
  if (prefs.quietStartMin < prefs.quietEndMin) {
    return nowMin >= prefs.quietStartMin && nowMin < prefs.quietEndMin;
  }
  return nowMin >= prefs.quietStartMin || nowMin < prefs.quietEndMin;
}

export function shouldShowAdaptiveNudge(input: {
  preferences: ReminderPreferences;
  latestCheckIn: StressCheckIn | null;
  latestEntryAt: number | null;
}): string | null {
  const { preferences, latestCheckIn, latestEntryAt } = input;
  if (!preferences.enabled) {
    return null;
  }

  const now = Date.now();
  if (inQuietHours(minuteOfDay(new Date(now)), preferences)) {
    return null;
  }

  if (latestCheckIn && latestCheckIn.stressIntensity >= 8) {
    return 'High stress detected recently. Try a 60-second grounding check-in.';
  }

  if (!latestEntryAt) {
    return 'Add a short voice note to keep your stress trend accurate this week.';
  }

  const hoursSinceEntry = (now - latestEntryAt) / (1000 * 60 * 60);
  if (hoursSinceEntry >= 36 && preferences.adaptive) {
    return 'It has been a while since your last check-in. A quick voice note can help unload stress.';
  }

  return null;
}

export function formatMinutes(minute: number): string {
  const safe = ((minute % 1440) + 1440) % 1440;
  const h24 = Math.floor(safe / 60);
  const m = safe % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}
