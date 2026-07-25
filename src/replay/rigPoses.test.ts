import { describe, it, expect } from 'vitest';
import { RIG_POSES, type RigPose } from './rigPoses';
import { POSES, type PoseName } from './poses';

const ALL_NAMES = Object.keys(RIG_POSES) as PoseName[];

describe('rig poses', () => {
  it('POSES (old model) has an entry for every PoseName incl. the per-strike ones', () => {
    for (const n of ALL_NAMES) expect(POSES[n]).toBeDefined();
  });

  it('RIG_POSES has an articulated entry (all 10 joints + bodyY + rigX) for every PoseName', () => {
    for (const n of ALL_NAMES) {
      const p: RigPose = RIG_POSES[n];
      for (const j of ['torso', 'head', 'armLead', 'foreLead', 'armRear', 'foreRear',
                       'thighLead', 'shinLead', 'thighRear', 'shinRear', 'bodyY', 'rigX'] as const) {
        expect(typeof p[j]).toBe('number');
      }
    }
  });

  it('kick-contact rotates the rear thigh forward relative to guard (a kick, not a punch)', () => {
    expect(RIG_POSES['kick-contact'].thighRear).toBeGreaterThan(RIG_POSES['guard'].thighRear);
  });

  it('down does not encode an 80deg torso (single knockdown owner is the rig root)', () => {
    expect(Math.abs(RIG_POSES['down'].torso)).toBeLessThan(45);
  });
});
