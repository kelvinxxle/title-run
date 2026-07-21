import { describe, it, expect } from 'vitest';
import { simulateFight } from './simulateFight';
import type { ExchangeMove } from '../domain/combat/intents';

const kick: ExchangeMove = { kind: 'strike', strike: 'legKick' };

describe('simulateFight', () => {
  it('returns beats.length === script.length for non-finishing scripts', () => {
    const { beats } = simulateFight('t', [kick, kick, kick]);
    expect(beats.length).toBe(3);
  });

  it('is deterministic', () => {
    const a = simulateFight('seed', [kick]);
    const b = simulateFight('seed', [kick]);
    expect(a.beats).toEqual(b.beats);
  });

  it('a scripted clip with signature fires contains a beat with signatureId === the-left-hand', () => {
    const { beats } = simulateFight('mcgregor-lab-001', [
      kick, kick, kick, kick, kick, kick, kick, kick,
      { kind: 'signature' },
    ]);
    expect(beats.some(b => b.signatureId === 'the-left-hand')).toBe(true);
  });
});
