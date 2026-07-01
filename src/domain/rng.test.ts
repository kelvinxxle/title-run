import { describe, it, expect } from 'vitest';
import { createRng, randInt, pick, shuffle } from './rng';

describe('seeded rng', () => {
  it('produces a deterministic sequence for a string seed', () => {
    const rng = createRng('title-run');
    const seq = [rng(), rng(), rng(), rng(), rng()];
    expect(seq[0]).toBeCloseTo(0.882116372, 9);
    expect(seq[1]).toBeCloseTo(0.4596152566, 9);
    expect(seq[2]).toBeCloseTo(0.3886326398, 9);
    expect(seq[3]).toBeCloseTo(0.9923890054, 9);
    expect(seq[4]).toBeCloseTo(0.5112489781, 9);
  });
  it('is reproducible: same seed yields the same sequence', () => {
    const a = createRng('title-run');
    const b = createRng('title-run');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('supports numeric seeds', () => {
    const rng = createRng(42);
    expect(rng()).toBeCloseTo(0.1682699858, 9);
  });
  it('returns integers within an inclusive range', () => {
    const rng = createRng('dice');
    const rolls = Array.from({ length: 10 }, () => randInt(rng, 1, 6));
    expect(rolls).toEqual([3, 5, 4, 3, 6, 5, 3, 1, 6, 3]);
    expect(rolls.every((n) => n >= 1 && n <= 6)).toBe(true);
  });
  it('picks deterministically and never mutates the source', () => {
    const rng = createRng('pick');
    const items = ['a', 'b', 'c', 'd'] as const;
    const picks = Array.from({ length: 8 }, () => pick(rng, items));
    expect(picks).toEqual(['d', 'b', 'a', 'b', 'a', 'a', 'd', 'c']);
    expect(items).toEqual(['a', 'b', 'c', 'd']);
  });
  it('throws when picking from an empty array', () => {
    const rng = createRng('x');
    expect(() => pick(rng, [])).toThrow();
  });
  it('shuffles into a permutation without mutating the source', () => {
    const rng = createRng('shuffle');
    const items = [1, 2, 3, 4, 5];
    const out = shuffle(rng, items);
    expect(out).toHaveLength(5);
    expect([...out].sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5]);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('randInt validation', () => {
  it('throws when max < min', () => {
    const rng = createRng('x');
    expect(() => randInt(rng, 5, 1)).toThrow(/max must be >= min/);
  });
  it('throws when a bound is not finite', () => {
    const rng = createRng('x');
    expect(() => randInt(rng, 0, Infinity)).toThrow(/finite/);
    expect(() => randInt(rng, NaN, 3)).toThrow(/finite/);
  });
  it('still returns an in-range integer for valid bounds', () => {
    const rng = createRng('seed');
    for (let i = 0; i < 50; i++) {
      const v = randInt(rng, 2, 6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThanOrEqual(6);
    }
  });
});
