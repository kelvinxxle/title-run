import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { STARTER_ROSTER } from '../domain/combat/roster';

const NO_IMAGE = new Set(['journeyman-doe', 'rudy-kane']); // fictional → avatar fallback

describe('shipped fighter images', () => {
  for (const f of STARTER_ROSTER) {
    if (NO_IMAGE.has(f.id)) continue;
    it(`has a non-empty public/fighters/${f.id}.jpg`, () => {
      const p = `public/fighters/${f.id}.jpg`;
      expect(fs.existsSync(p)).toBe(true);
      expect(fs.statSync(p).size).toBeGreaterThan(1000);
    });
  }
  it('writes a CREDITS.md', () => {
    expect(fs.existsSync('public/fighters/CREDITS.md')).toBe(true);
  });
});
