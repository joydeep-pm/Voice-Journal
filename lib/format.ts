export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function pickEntryTitle(summary: string | null, fallbackTitle: string | null): string {
  if (fallbackTitle?.trim()) {
    return fallbackTitle.trim();
  }

  if (summary?.trim()) {
    return summary.trim().split('\n')[0];
  }

  return 'Audio entry';
}
