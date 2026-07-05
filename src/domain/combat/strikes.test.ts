import { describe, it, expect } from 'vitest';
import { STRIKES, STRIKE_PALETTE, strikeProfile, type StrikeId } from './strikes';

describe('strike palette', () => {
  it('exposes exactly six strikes in the palette', () => {
    expect(STRIKE_PALETTE).toEqual(['jab', 'powerPunch', 'bodyKick', 'legKick', 'knee', 'elbow']);
  });

  it('every palette id has a complete, valid profile', () => {
    for (const id of STRIKE_PALETTE) {
      const p = STRIKES[id];
      expect(p.id).toBe(id);
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.blurb.length).toBeGreaterThan(0);
      expect(['head', 'body', 'legs']).toContain(p.target);
      expect(p.atkMult).toBeGreaterThan(0);
      expect(p.defMult).toBeGreaterThan(0);
      expect(p.power).toBeGreaterThan(0);
      expect(p.staminaCost).toBeGreaterThan(0);
      expect(p.koWeight).toBeGreaterThanOrEqual(0);
      expect(p.speed).toBeGreaterThanOrEqual(0);
      expect(p.speed).toBeLessThanOrEqual(1);
    }
  });

  it('targets are wired as designed', () => {
    expect(STRIKES.jab.target).toBe('head');
    expect(STRIKES.powerPunch.target).toBe('head');
    expect(STRIKES.bodyKick.target).toBe('body');
    expect(STRIKES.legKick.target).toBe('legs');
    expect(STRIKES.knee.target).toBe('body');
    expect(STRIKES.elbow.target).toBe('head');
  });

  it('power punch out-powers the jab but is slower and costs more', () => {
    expect(STRIKES.powerPunch.power).toBeGreaterThan(STRIKES.jab.power);
    expect(STRIKES.powerPunch.speed).toBeLessThan(STRIKES.jab.speed);
    expect(STRIKES.powerPunch.staminaCost).toBeGreaterThan(STRIKES.jab.staminaCost);
  });

  it('strikeProfile returns the table entry', () => {
    const id: StrikeId = 'elbow';
    expect(strikeProfile(id)).toBe(STRIKES.elbow);
  });
});
