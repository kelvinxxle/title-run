import { describe, it, expect } from 'vitest';
import { ARCHETYPES, archetypeFromStatLine } from './archetypes';
import { STARTER_ROSTER, buildStatLine } from './roster';
import type { ArchetypeId } from './archetypes';

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

describe('archetypeFromStatLine', () => {
  const base = { strikingDef: 60, takedownDef: 60, submissionDef: 60, cardio: 60, chin: 60, fightIQ: 60 };

  it('striking-dominant stat line returns striker', () => {
    const s = { ...base, striking: 85, takedowns: 50, submissions: 45 };
    expect(archetypeFromStatLine(s)).toBe('striker');
  });

  it('takedown-dominant stat line returns wrestler', () => {
    const s = { ...base, striking: 50, takedowns: 85, submissions: 45 };
    expect(archetypeFromStatLine(s)).toBe('wrestler');
  });

  it('submission-dominant stat line returns grappler', () => {
    const s = { ...base, striking: 45, takedowns: 50, submissions: 85 };
    expect(archetypeFromStatLine(s)).toBe('grappler');
  });

  it('near-balanced top two offensive stats (within ≤5) returns allrounder', () => {
    // striking=80, takedowns=77, submissions=50 → top two differ by 3 → allrounder
    const s = { ...base, striking: 80, takedowns: 77, submissions: 50 };
    expect(archetypeFromStatLine(s)).toBe('allrounder');
  });

  it('is deterministic — same input returns the same known output on every call', () => {
    // striking=70, takedowns=65, submissions=40 → top two differ by 5 → allrounder
    const s = { ...base, striking: 70, takedowns: 65, submissions: 40 };
    const expected: ArchetypeId = 'allrounder';
    expect(archetypeFromStatLine(s)).toBe(expected);
    expect(archetypeFromStatLine(s)).toBe(expected);
  });

  it('top two offensive stats exactly 5 apart returns allrounder (band edge, inclusive)', () => {
    // striking=80, takedowns=75, submissions=40 → 80−75=5 ≤5 → allrounder
    const s = { ...base, striking: 80, takedowns: 75, submissions: 40 };
    expect(archetypeFromStatLine(s)).toBe('allrounder');
  });

  it('top two offensive stats exactly 6 apart returns the dominant archetype (just outside band)', () => {
    // striking=80, takedowns=74, submissions=40 → 80−74=6 >5 → striker
    const s = { ...base, striking: 80, takedowns: 74, submissions: 40 };
    expect(archetypeFromStatLine(s)).toBe('striker');
  });

  it('every STARTER_ROSTER fighter buildStatLine returns a valid ArchetypeId', () => {
    const valid: ArchetypeId[] = ['striker', 'wrestler', 'grappler', 'allrounder'];
    for (const fighter of STARTER_ROSTER) {
      const result = archetypeFromStatLine(buildStatLine(fighter));
      expect(valid).toContain(result);
    }
  });
});

