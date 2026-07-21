import { describe, it, expect } from 'vitest';
import { heroFraming, HERO_FRAMING, DEFAULT_HERO_FRAMING } from './heroFraming';
import { STARTER_ROSTER } from '../domain/combat';

describe('heroFraming', () => {
  it('returns the face-biased default for an un-overridden fighter', () => {
    expect(heroFraming('conor-mcgregor')).toBe(DEFAULT_HERO_FRAMING);
    expect(heroFraming('unknown-id')).toBe('50% 20%');
  });

  it('returns the explicit override for a curated fighter', () => {
    expect(heroFraming('ronaldo-souza')).toBe('50% 12%');
    expect(heroFraming('ronaldo-souza')).toBe(HERO_FRAMING['ronaldo-souza']);
  });

  it('is total over the whole roster and always yields a valid object-position', () => {
    for (const f of STARTER_ROSTER) {
      const pos = heroFraming(f.id);
      expect(typeof pos).toBe('string');
      expect(pos).toMatch(/^\d{1,3}% \d{1,3}%$/);
    }
  });

  it('only overrides ids that exist in the roster', () => {
    const ids = new Set(STARTER_ROSTER.map((f) => f.id));
    for (const id of Object.keys(HERO_FRAMING)) {
      expect(ids.has(id)).toBe(true);
    }
  });
});
