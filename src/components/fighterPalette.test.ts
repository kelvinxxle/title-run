import { describe, it, expect } from 'vitest';
import { fighterPalette } from './fighterPalette';

describe('fighterPalette', () => {
  it('is deterministic: same seed + archetype produce identical palette', () => {
    const seed = 'israel-adesanya';
    const archetype = 'striker';
    const a = fighterPalette(seed, archetype);
    const b = fighterPalette(seed, archetype);
    expect(a).toEqual(b);
  });

  it('produces distinct palettes for different seeds', () => {
    const archetype = 'striker';
    const p1 = fighterPalette('seed-1', archetype);
    const p2 = fighterPalette('seed-2', archetype);
    const p3 = fighterPalette('seed-3', archetype);
    // At least some should differ
    const palettes = [p1, p2, p3];
    const distinct = new Set(palettes.map(p => JSON.stringify(p)));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('applies the correct archetype accent colors', () => {
    const accents: Record<string, string> = {
      striker: '#e23b2e',
      wrestler: '#2f6fe0',
      grappler: '#7c3aed',
      allrounder: '#22a34a',
      brawler: '#e8791f',
    };
    for (const [archetype, expectedAccent] of Object.entries(accents)) {
      const palette = fighterPalette('seed-x', archetype);
      expect(palette.accent).toBe(expectedAccent);
    }
  });

  it('falls back to neutral gray for unknown archetypes', () => {
    const p1 = fighterPalette('seed-y', 'unknown');
    const p2 = fighterPalette('seed-z', '');
    const p3 = fighterPalette('seed-w', 'toString'); // prototype name
    expect(p1.accent).toBe('#8a8f98');
    expect(p2.accent).toBe('#8a8f98');
    expect(p3.accent).toBe('#8a8f98');
  });

  it('returns all required palette properties', () => {
    const palette = fighterPalette('seed-test', 'striker');
    expect(palette).toHaveProperty('skin');
    expect(palette).toHaveProperty('glove');
    expect(palette).toHaveProperty('accent');
    expect(palette).toHaveProperty('hair');
    expect(palette).toHaveProperty('bg');
    expect(typeof palette.skin).toBe('string');
    expect(typeof palette.glove).toBe('string');
    expect(typeof palette.accent).toBe('string');
    expect(typeof palette.hair).toBe('string');
    expect(typeof palette.bg).toBe('string');
  });
});
