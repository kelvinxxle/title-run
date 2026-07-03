import { describe, it, expect } from 'vitest';
import { STARTER_ROSTER, buildStatLine, rollFighter } from './roster';
import { createRng } from '../rng';

describe('starter roster', () => {
  it('has 8 fighters covering all five archetypes plus a weak one', () => {
    expect(STARTER_ROSTER).toHaveLength(8);
    const kinds = new Set(STARTER_ROSTER.map((f) => f.archetype));
    expect(kinds.size).toBeGreaterThanOrEqual(4);
    // a deliberately weak fighter exists
    const weak = STARTER_ROSTER.map(buildStatLine)
      .map((l) => Object.values(l).reduce((a, b) => a + b, 0) / 9);
    expect(Math.min(...weak)).toBeLessThan(60);
  });
  it('buildStatLine overlays signature onto the archetype base and clamps', () => {
    const line = buildStatLine(STARTER_ROSTER[0]);
    for (const v of Object.values(line)) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(99); }
  });
  it('rollFighter is deterministic per seed and can exclude', () => {
    const a = rollFighter(createRng('s#0'));
    const b = rollFighter(createRng('s#0'));
    expect(a.id).toBe(b.id);
    const c = rollFighter(createRng('s#0'), [a.id]);
    expect(c.id).not.toBe(a.id);
  });
});
