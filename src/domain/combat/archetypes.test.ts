import { describe, it, expect } from 'vitest';
import { ARCHETYPES } from './archetypes';

describe('archetypes', () => {
  it('striker leads on striking, brawler on chin, wrestler on takedowns, grappler on submissions', () => {
    expect(ARCHETYPES.striker.striking).toBeGreaterThanOrEqual(75);
    expect(ARCHETYPES.brawler.chin).toBeGreaterThanOrEqual(80);
    expect(ARCHETYPES.wrestler.takedowns).toBeGreaterThanOrEqual(80);
    expect(ARCHETYPES.grappler.submissions).toBeGreaterThanOrEqual(80);
  });
  it('every archetype defines all 9 stats within range', () => {
    for (const line of Object.values(ARCHETYPES)) {
      for (const v of Object.values(line)) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(99); }
    }
  });
});
