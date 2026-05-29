import { describe, expect, it } from 'vitest';
import { formatDurationSeconds } from './duration';

describe('formatDurationSeconds', () => {
  it('renders round-day cooldowns in days', () => {
    expect(formatDurationSeconds(86400)).toBe('1 day');
    expect(formatDurationSeconds(86400 * 7)).toBe('7 days');
  });

  it('renders round-hour cooldowns in hours', () => {
    expect(formatDurationSeconds(3600)).toBe('1 hour');
    expect(formatDurationSeconds(3600 * 24)).toBe('1 day');
    expect(formatDurationSeconds(3600 * 6)).toBe('6 hours');
  });

  it('keeps the largest whole unit rather than rounding up', () => {
    expect(formatDurationSeconds(5400)).toBe('90 minutes');
  });

  it('falls back to seconds for sub-minute or non-aligned values', () => {
    expect(formatDurationSeconds(45)).toBe('45 seconds');
    expect(formatDurationSeconds(1)).toBe('1 second');
    expect(formatDurationSeconds(3601)).toBe('3601 seconds');
  });

  it('treats zero / negatives as zero', () => {
    expect(formatDurationSeconds(0)).toBe('0 seconds');
    expect(formatDurationSeconds(-30)).toBe('0 seconds');
  });
});
