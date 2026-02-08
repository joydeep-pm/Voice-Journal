import type { Entry, WeeklyTheme } from '@/src/db/types';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'have', 'from', 'were', 'been', 'about', 'into', 'your', 'just',
  'audio', 'entry', 'today', 'journal', 'after', 'before', 'while', 'when', 'what', 'they', 'there', 'their', 'them',
]);

function weekKey(timestampMs: number) {
  const date = new Date(timestampMs);
  const copy = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = copy.getUTCDay() || 7;
  copy.setUTCDate(copy.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(copy.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${copy.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !STOP_WORDS.has(word));
}

export function buildWeeklyThemes(entries: Entry[]): WeeklyTheme[] {
  const grouped = new Map<string, Entry[]>();

  for (const entry of entries) {
    const key = weekKey(entry.createdAt);
    const list = grouped.get(key) ?? [];
    list.push(entry);
    grouped.set(key, list);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([week, weekEntries]) => {
      const counts = new Map<string, number>();

      for (const entry of weekEntries) {
        const source = `${entry.summary ?? ''} ${entry.transcript ?? ''}`;
        for (const word of words(source)) {
          counts.set(word, (counts.get(word) ?? 0) + 1);
        }
      }

      const theme = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([word]) => word)
        .join(', ');

      return {
        week,
        theme: theme || 'General reflections',
        entryIds: weekEntries.map((entry) => entry.id),
      };
    });
}
