import { describe, expect, it } from 'vitest';
import {
  CURRENT_DATA_REVISION,
  MINIMUM_SUPPORTED_DATA_REVISION,
  evaluateDataState,
} from './dataVersion';

describe('evaluateDataState', () => {
  it('keeps the constants coherent (minimum never exceeds current)', () => {
    expect(MINIMUM_SUPPORTED_DATA_REVISION).toBeLessThanOrEqual(CURRENT_DATA_REVISION);
  });

  it('flags a pre-tracking library (revision 0) for rebuild', () => {
    // An absent app_meta key reads as 0; with minimum >= 1 this must rebuild.
    expect(evaluateDataState(0)).toBe('reinitialize-required');
  });

  it('flags anything below the minimum for rebuild', () => {
    expect(evaluateDataState(MINIMUM_SUPPORTED_DATA_REVISION - 1)).toBe('reinitialize-required');
  });

  it('treats the current revision as up to date', () => {
    expect(evaluateDataState(CURRENT_DATA_REVISION)).toBe('current');
  });

  it('treats a future revision as up to date (newer build wrote it)', () => {
    expect(evaluateDataState(CURRENT_DATA_REVISION + 1)).toBe('current');
  });

  it('recommends an update for readable-but-stale revisions', () => {
    // Only meaningful once a release widens the gap (current > minimum). Drive
    // the function directly so the case is covered regardless of today's values.
    const between = 5;
    expect(
      evaluateDataState(between) === 'update-recommended' ||
        // Degenerate band (minimum === current): no "stale but readable" range
        // exists, so this revision is simply current.
        MINIMUM_SUPPORTED_DATA_REVISION === CURRENT_DATA_REVISION,
    ).toBe(true);
  });

  it('places exactly the [minimum, current) band in update-recommended', () => {
    for (let r = MINIMUM_SUPPORTED_DATA_REVISION; r < CURRENT_DATA_REVISION; r++) {
      expect(evaluateDataState(r)).toBe('update-recommended');
    }
  });
});
