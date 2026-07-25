import { describe, it, expect } from 'vitest';
import { POSES, type PoseName } from './poses';

/**
 * The name list below is a `Record<PoseName, true>`, so TypeScript fails the build if a new
 * PoseName is added to the union without being covered here. That is deliberate: a pose that
 * exists in the type but has no geometry silently renders as `undefined` in the rig.
 */
const NAME_COVERAGE: Record<PoseName, true> = {
  idle: true, guard: true, jab: true, cross: true, hook: true, slip: true,
  'hit-head': true, 'hit-body': true, reel: true, down: true, 'sig-load': true, 'sig-fire': true,
  'punch-load': true, 'punch-contact': true, 'kick-load': true, 'kick-contact': true, 'hit-leg': true,
  'jab-load': true, 'jab-contact': true,
  'powerPunch-load': true, 'powerPunch-contact': true,
  'elbow-load': true, 'elbow-contact': true,
  'legKick-load': true, 'legKick-contact': true,
  'bodyKick-load': true, 'bodyKick-contact': true,
  'knee-load': true, 'knee-contact': true,
  'finish-load': true, 'finish-contact': true,
};

const ALL_NAMES = Object.keys(NAME_COVERAGE) as PoseName[];

const NEW_NAMES: PoseName[] = [
  'punch-load', 'punch-contact', 'kick-load', 'kick-contact', 'hit-leg',
];

describe('POSES record', () => {
  it('has an entry for every PoseName value', () => {
    expect(Object.keys(POSES).length).toBe(ALL_NAMES.length);
    for (const name of ALL_NAMES) {
      expect(POSES).toHaveProperty(name);
    }
  });

  it('has defined entries (not undefined) for all PoseName values', () => {
    for (const name of ALL_NAMES) {
      expect(POSES[name]).toBeDefined();
    }
  });

  it('includes all 5 new pose names added in Task 1', () => {
    for (const name of NEW_NAMES) {
      expect(POSES[name]).toBeDefined();
      expect(POSES[name]).toHaveProperty('torsoRotate');
      expect(POSES[name]).toHaveProperty('headX');
      expect(POSES[name]).toHaveProperty('headY');
      expect(POSES[name]).toHaveProperty('leadArm');
      expect(POSES[name]).toHaveProperty('rearArm');
      expect(POSES[name]).toHaveProperty('lean');
    }
  });

  it('each pose has a valid structure', () => {
    for (const pose of Object.values(POSES)) {
      expect(typeof pose.torsoRotate).toBe('number');
      expect(typeof pose.headX).toBe('number');
      expect(typeof pose.headY).toBe('number');
      expect(typeof pose.lean).toBe('number');

      expect(pose.leadArm).toBeDefined();
      expect(typeof pose.leadArm.rotate).toBe('number');
      expect(typeof pose.leadArm.extend).toBe('number');

      expect(pose.rearArm).toBeDefined();
      expect(typeof pose.rearArm.rotate).toBe('number');
      expect(typeof pose.rearArm.extend).toBe('number');
    }
  });
});
