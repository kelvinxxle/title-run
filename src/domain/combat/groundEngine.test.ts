import { describe, it, expect } from 'vitest';
import { groundPoundDamage, groundSubProbability, advanceProbability, escapeProbability } from './groundEngine';
import { groundAndPoundDamage } from './finish';
import type { StatLine } from './stats';

const strong: StatLine = { striking: 80, strikingDef: 75, takedowns: 85, takedownDef: 82, submissions: 82, submissionDef: 80, cardio: 78, chin: 70, fightIQ: 78 };
const weak: StatLine   = { striking: 40, strikingDef: 42, takedowns: 38, takedownDef: 40, submissions: 40, submissionDef: 42, cardio: 45, chin: 50, fightIQ: 44 };
const moderate: StatLine = { striking: 60, strikingDef: 62, takedowns: 58, takedownDef: 60, submissions: 60, submissionDef: 62, cardio: 60, chin: 60, fightIQ: 60 };

describe('ground math', () => {
  it('G&P scales up with position quality (mount hits harder than guard)', () => {
    const base = groundAndPoundDamage(strong, weak);
    expect(groundPoundDamage(strong, weak, 'guard')).toBe(base); // quality 0 → ×1
    expect(groundPoundDamage(strong, weak, 'mount')).toBeGreaterThan(groundPoundDamage(strong, weak, 'guard'));
    expect(groundPoundDamage(strong, weak, 'back')).toBeGreaterThan(groundPoundDamage(strong, weak, 'mount'));
  });

  it('submission probability is 0 in neutral guard, rises with position and a gassed defender, clamped ≤0.95', () => {
    expect(groundSubProbability(strong, weak, 'guard', false)).toBe(0);
    const dry = groundSubProbability(moderate, weak, 'half-guard', false);
    const gassed = groundSubProbability(moderate, weak, 'half-guard', true);
    expect(gassed).toBeGreaterThan(dry);
    expect(groundSubProbability(moderate, weak, 'mount', false))
      .toBeGreaterThan(groundSubProbability(moderate, weak, 'half-guard', false));
    expect(gassed).toBeLessThanOrEqual(0.95);
  });

  it('advance favors the better wrestler; escape favors the better defensive wrestler; both clamped', () => {
    expect(advanceProbability(strong, weak)).toBeGreaterThan(advanceProbability(weak, strong));
    expect(advanceProbability(strong, weak)).toBeLessThanOrEqual(0.90);
    expect(advanceProbability(weak, strong)).toBeGreaterThanOrEqual(0.15);
    expect(escapeProbability(weak, strong)).toBeGreaterThan(escapeProbability(strong, weak));
    expect(escapeProbability(weak, strong)).toBeLessThanOrEqual(0.60);
    expect(escapeProbability(strong, weak)).toBeGreaterThanOrEqual(0.05);
  });
});
