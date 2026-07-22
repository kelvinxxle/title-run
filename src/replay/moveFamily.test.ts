import { describe, it, expect } from 'vitest';
import { moveFamily } from './moveFamily';
import { STRIKE_PALETTE } from '../domain/combat/strikes';

describe('moveFamily', () => {
  it('maps every production StrikeId to a family (total function, no fallthrough to punch)', () => {
    const map: Record<string, string> = {
      jab: 'punch', powerPunch: 'punch', elbow: 'punch',
      bodyKick: 'kick', legKick: 'kick', knee: 'kick',
    };
    for (const id of STRIKE_PALETTE) {
      expect(moveFamily(id, 'strike')).toBe(map[id]);
    }
  });

  it('routes signature and takedown by moveClass, never faking a punch', () => {
    expect(moveFamily('check-hook', 'signature')).toBe('signature');
    expect(moveFamily('double-leg', 'takedown')).toBe('takedown');
    expect(moveFamily(null, 'ground')).toBe('takedown');
  });
});
