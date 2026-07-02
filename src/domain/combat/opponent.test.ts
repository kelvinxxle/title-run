import { describe, it, expect } from 'vitest';
import { generateOpponent, targetRating } from './opponent';

const avg = (l: Record<string, number>) => Object.values(l).reduce((a,b)=>a+b,0)/9;

describe('opponent scaling', () => {
  it('ramps smoothly and never maxes out (beatable ceiling)', () => {
    const ratings = [1,2,3,4,5,6,7,8,9,10].map((n) => targetRating(n));
    for (let i = 1; i < ratings.length; i++) expect(ratings[i]).toBeGreaterThanOrEqual(ratings[i-1]);
    expect(Math.max(...ratings)).toBeLessThanOrEqual(90); // headroom for a good player
    expect(ratings[9] - ratings[0]).toBeLessThanOrEqual(40); // no cliff
  });
  it('is deterministic and roughly hits the target rating', () => {
    const a = generateOpponent('s', 3), b = generateOpponent('s', 3);
    expect(a).toEqual(b);
    expect(Math.abs(avg(a.statLine) - targetRating(3))).toBeLessThanOrEqual(2);
  });
  it('statLine average is within ±2 of targetRating for all archetypes across fightNumbers 1..10', () => {
    // 20 seeds × 10 fightNumbers covers all 5 archetypes many times including brawler at n=8..10
    const seeds = Array.from({ length: 20 }, (_, i) => `seed-${i}`);
    for (const seed of seeds) {
      for (let n = 1; n <= 10; n++) {
        const opp = generateOpponent(seed, n);
        const actual = avg(opp.statLine);
        const target = targetRating(n);
        expect(
          Math.abs(actual - target),
          `seed=${seed} n=${n} archetype=${opp.archetype}: avg=${actual.toFixed(2)}, target=${target}`,
        ).toBeLessThanOrEqual(2);
      }
    }
  });
});
