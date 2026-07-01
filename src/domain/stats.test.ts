import { describe, it, expect } from 'vitest';
import { STAT_IDS, STAT_LABELS, clampStat, isStatId, STAT_MIN, STAT_MAX } from './stats';

describe('stat model', () => {
  it('defines exactly the nine stats in canonical order', () => {
    expect(STAT_IDS).toEqual(['boxing','kicks','clinch','takedowns','submissions','topControl','cardio','chin','fightIQ']);
  });
  it('labels every stat with a display name', () => {
    expect(STAT_IDS.every((id) => typeof STAT_LABELS[id] === 'string' && STAT_LABELS[id].length > 0)).toBe(true);
    expect(STAT_LABELS.topControl).toBe('Top Control');
    expect(STAT_LABELS.fightIQ).toBe('Fight IQ');
  });
  it('clamps values into [1,99] and rounds to integers', () => {
    expect(clampStat(0)).toBe(STAT_MIN);
    expect(clampStat(150)).toBe(STAT_MAX);
    expect(clampStat(50)).toBe(50);
    expect(clampStat(50.7)).toBe(51);
  });
  it('recognises valid stat ids', () => {
    expect(isStatId('boxing')).toBe(true);
    expect(isStatId('wingspan')).toBe(false);
  });
});

describe('isStatId accepts unknown', () => {
  it('returns true for a valid stat id', () => { expect(isStatId('boxing')).toBe(true); });
  it('returns false for a non-matching string', () => { expect(isStatId('nope')).toBe(false); });
  it('returns false for non-string values', () => {
    expect(isStatId(123 as unknown)).toBe(false);
    expect(isStatId(null as unknown)).toBe(false);
    expect(isStatId(undefined as unknown)).toBe(false);
    expect(isStatId({} as unknown)).toBe(false);
  });
});
