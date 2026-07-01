import { describe, it, expect } from 'vitest';
import { STAT_IDS } from './stats';
import { ARCHETYPE_IDS } from './archetypes';
import { targetRating, generateOpponent } from './opponent';

const avg = (sl: Record<string, number>) =>
  Math.round(STAT_IDS.reduce((s, k) => s + sl[k], 0) / STAT_IDS.length);

describe('targetRating', () => {
  it('climbs gently for fights 1-4 then escalates from the title fight', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map(targetRating)).toEqual([58, 62, 66, 70, 74, 79, 84, 89]);
  });
});

describe('generateOpponent', () => {
  it('is fully deterministic for a fixed seed + fight number', () => {
    expect(generateOpponent('run-42', 1)).toEqual(generateOpponent('run-42', 1));
  });
  it('produces the exact scouted opponent for seed "run-42", fight 1', () => {
    expect(generateOpponent('run-42', 1)).toEqual({
      id: 'opp-1',
      name: 'Hideo "Granite" Stone',
      style: 'grappler',
      statLine: { boxing: 44, kicks: 42, clinch: 58, takedowns: 66, submissions: 74, topControl: 72, cardio: 56, chin: 52, fightIQ: 62 },
    });
  });
  it('scales the average rating toward targetRating (within clamp drift)', () => {
    for (const n of [1, 2, 3, 5, 6]) {
      const o = generateOpponent('run-42', n);
      expect(o.id).toBe(`opp-${n}`);
      expect(ARCHETYPE_IDS).toContain(o.style);
      // clampStat caps individual stats at 99, so at high difficulty a high-baseline
      // stat can overflow its target delta and get capped, pulling the realized
      // average below target. Drift is therefore downward-only and ≤1 for fights 1–6.
      const drift = targetRating(n) - avg(o.statLine);
      expect(drift).toBeGreaterThanOrEqual(0);
      expect(drift).toBeLessThanOrEqual(1);
    }
  });
  it('gives different fights distinct opponents under the same run seed', () => {
    const f1 = generateOpponent('run-42', 1);
    const f2 = generateOpponent('run-42', 2);
    expect(f2.id).not.toBe(f1.id);
    expect(f2.name).not.toBe(f1.name);
  });
});
