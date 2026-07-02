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
});
