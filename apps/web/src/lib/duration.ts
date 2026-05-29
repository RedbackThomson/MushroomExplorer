/**
 * Picks the largest unit that divides evenly so authored round numbers
 * (3600 → "1 hour", 86400 → "1 day") survive, and 5400 stays "90 minutes"
 * instead of collapsing to "1.5 hours".
 */
export function formatDurationSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0 seconds';
  const s = Math.floor(totalSeconds);
  const units: { unit: number; singular: string; plural: string }[] = [
    { unit: 86400, singular: 'day', plural: 'days' },
    { unit: 3600, singular: 'hour', plural: 'hours' },
    { unit: 60, singular: 'minute', plural: 'minutes' },
  ];
  for (const { unit, singular, plural } of units) {
    if (s >= unit && s % unit === 0) {
      const n = s / unit;
      return `${n} ${n === 1 ? singular : plural}`;
    }
  }
  return `${s} ${s === 1 ? 'second' : 'seconds'}`;
}
