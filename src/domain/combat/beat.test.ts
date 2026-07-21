import { describe, it, expect } from 'vitest';
import { buildResolvedBeat, type BuildBeatArgs } from './beat';

const base: BuildBeatArgs = {
  round: 1, exchange: 3, winner: 'player', dominance: 40,
  moveClass: 'strike', moveId: 'cross', target: 'head',
  deltas: { playerHead:0,playerBody:0,playerLeg:0,playerStamina:-4, opponentHead:22,opponentBody:0,opponentLeg:0,opponentStamina:-2 },
  status: { playerBecameRocked:false, opponentBecameRocked:true, playerGassed:false, opponentGassed:false },
  signatureId: null, isFinish: false, finishMethod: null,
};

it('maps winner to actor/target and stable id', () => {
  const b = buildResolvedBeat(base);
  expect(b.id).toBe('1-3');
  expect(b.actorId).toBe('player');
  expect(b.targetId).toBe('opponent');
  expect(b.outcome).toBe('landed');
});
it('classifies a small-margin exchange as evaded', () => {
  expect(buildResolvedBeat({ ...base, dominance: 3 }).outcome).toBe('evaded');
});
it('classifies a player signature detonation as countered', () => {
  const b = buildResolvedBeat({ ...base, moveClass:'signature', signatureId:'the-left-hand', dominance: 90 });
  expect(b.outcome).toBe('countered');
  expect(b.signatureId).toBe('the-left-hand');
});
it('a finish is always landed and carries the method', () => {
  const b = buildResolvedBeat({ ...base, isFinish:true, finishMethod:'KO', dominance: 120 });
  expect(b.outcome).toBe('landed');
  expect(b.isFinish).toBe(true);
  expect(b.finishMethod).toBe('KO');
});
it('opponent winner flips actor/target', () => {
  const b = buildResolvedBeat({ ...base, winner:'opponent', deltas: { ...base.deltas, opponentHead:0, playerHead:18 } });
  expect(b.actorId).toBe('opponent');
  expect(b.targetId).toBe('player');
  expect(b.outcome).toBe('landed');
});
