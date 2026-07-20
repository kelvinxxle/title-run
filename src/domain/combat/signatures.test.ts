import { describe, it, expect } from 'vitest';
import { resolveSignature, ARCHETYPE_SIGNATURE, MARQUEE_SIGNATURE, type SignatureMove } from './signatures';
import { STARTER_ROSTER } from './roster';
import { ARCHETYPE_IDS } from './archetypes';

describe('signatures', () => {
  it('every roster fighter resolves to a defined SignatureMove', () => {
    for (const fighter of STARTER_ROSTER) {
      const move = resolveSignature(fighter.id);
      expect(move).toBeDefined();
      expect(typeof move.id).toBe('string');
      expect(typeof move.label).toBe('string');
      expect(typeof move.flavor).toBe('string');
      expect(typeof move.atkMult).toBe('number');
      expect(move.atkMult).toBeGreaterThan(0);
    }
  });

  it('marquee ids return their curated override', () => {
    const conor = resolveSignature('conor-mcgregor');
    expect(conor).toBe(MARQUEE_SIGNATURE['conor-mcgregor']);
    expect(conor.id).toBe('the-left-hand');

    const jones = resolveSignature('jon-jones');
    expect(jones).toBe(MARQUEE_SIGNATURE['jon-jones']);
    expect(jones.id).toBe('spinning-elbow');
  });

  it('non-marquee ids fall back to archetype base', () => {
    // khabib is a wrestler and not in marquee table
    const khabib = resolveSignature('khabib-nurmagomedov');
    expect(khabib).toBe(ARCHETYPE_SIGNATURE['wrestler']);

    // Charles Oliveira is a grappler and not in marquee table
    const charles = resolveSignature('charles-oliveira');
    expect(charles).toBe(ARCHETYPE_SIGNATURE['grappler']);
  });

  it('all archetype bases are defined and stronger than powerPunch (atkMult > 1.35)', () => {
    for (const archId of ARCHETYPE_IDS) {
      const move = ARCHETYPE_SIGNATURE[archId];
      expect(move).toBeDefined();
      // Signature must be stronger on atkMult than powerPunch (1.35)
      expect(move.atkMult).toBeGreaterThan(1.35);
    }
  });

  it('resolveSignature is deterministic — same id always returns same object', () => {
    expect(resolveSignature('conor-mcgregor')).toBe(resolveSignature('conor-mcgregor'));
    expect(resolveSignature('israel-adesanya')).toBe(resolveSignature('israel-adesanya'));
    expect(resolveSignature('khabib-nurmagomedov')).toBe(resolveSignature('khabib-nurmagomedov'));
  });

  it('each SignatureMove has all required profile fields', () => {
    const allMoves: SignatureMove[] = [
      ...Object.values(ARCHETYPE_SIGNATURE),
      ...Object.values(MARQUEE_SIGNATURE),
    ];
    for (const move of allMoves) {
      expect(typeof move.id).toBe('string');
      expect(typeof move.label).toBe('string');
      expect(typeof move.blurb).toBe('string');
      expect(typeof move.flavor).toBe('string');
      expect(typeof move.atkMult).toBe('number');
      expect(typeof move.defMult).toBe('number');
      expect(typeof move.power).toBe('number');
      expect(typeof move.koWeight).toBe('number');
      expect(typeof move.speed).toBe('number');
    }
  });

  it('resolveSignature throws for unknown fighter id', () => {
    expect(() => resolveSignature('unknown-fighter-xyz')).toThrow();
  });
});
