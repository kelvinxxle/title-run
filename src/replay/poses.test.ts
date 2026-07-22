import { describe, it, expect } from 'vitest';
import { POSES, type PoseName, type Pose } from './poses';

const ALL_NAMES: PoseName[] = [
  'idle', 'guard', 'jab', 'cross', 'hook', 'slip', 'hit-head', 'hit-body',
  'reel', 'down', 'sig-load', 'sig-fire',
  'punch-load', 'punch-contact', 'kick-load', 'kick-contact', 'hit-leg',
];

const NEW_NAMES: PoseName[] = [
  'punch-load', 'punch-contact', 'kick-load', 'kick-contact', 'hit-leg',
];

describe('POSES record', () => {
  it('has an entry for all 17 PoseName values', () => {
    expect(Object.keys(POSES).length).toBe(17);
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
