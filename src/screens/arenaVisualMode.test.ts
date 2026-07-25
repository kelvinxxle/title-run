import { describe, it, expect } from 'vitest';
import { arenaVisualMode } from './arenaVisualMode';
import { buildResolvedBeat } from '../domain/combat/beat';

const strikeBeat = buildResolvedBeat({
  round: 1, exchange: 1, winner: 'player', dominance: 3,
  moveClass: 'strike', moveId: 'jab', outcome: 'landed', target: 'head',
  deltas: { playerHead: 0, playerBody: 0, playerLeg: 0, playerStamina: 0, opponentHead: 10, opponentBody: 0, opponentLeg: 0, opponentStamina: 1 },
  status: { playerBecameRocked: false, opponentBecameRocked: false, playerGassed: false, opponentGassed: false },
  signatureId: null, isFinish: false, finishMethod: null,
});
const finishBeat = { ...strikeBeat, isFinish: true, finishMethod: 'KO' as const };

describe('arenaVisualMode', () => {
  it('ground phase => mat', () => {
    expect(arenaVisualMode('ground', false, strikeBeat)).toBe('mat');
    expect(arenaVisualMode('ground', true, finishBeat)).toBe('mat'); // ground wins over everything
  });
  it('playing (non-ground) => active-playback', () => {
    expect(arenaVisualMode('in-round', true, strikeBeat)).toBe('active-playback');
    expect(arenaVisualMode('finish-window', true, strikeBeat)).toBe('active-playback');
  });
  it('settled finish => ko-down', () => {
    expect(arenaVisualMode('finished', false, finishBeat)).toBe('ko-down');
  });
  it('settled non-finish => standing-idle', () => {
    expect(arenaVisualMode('in-round', false, strikeBeat)).toBe('standing-idle');
    expect(arenaVisualMode('in-round', false, null)).toBe('standing-idle');
    expect(arenaVisualMode('corner', false, strikeBeat)).toBe('standing-idle');
  });
});
