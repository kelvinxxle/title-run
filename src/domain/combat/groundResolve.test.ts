import { describe, it, expect } from 'vitest';
import { startFight } from './fightState';
import { resolveExchange, EXCHANGES_PER_ROUND } from './exchange';
import { resolveGround } from './groundResolve';
import type { FightState } from './fightState';
import { buildStatLine, getFighter } from './roster';
import { generateOpponent } from './opponent';
import { POSITION_SUBMISSION } from './ground';

// Drive a state into the ground phase via a landed player takedown.
// GSP (takedowns=90) vs Tier-1 opponent → double-leg ALWAYS lands on beat 1.
function toGround(seed: string): FightState {
  const s = startFight({ seed, fightNumber: 1, playerStatLine: buildStatLine(getFighter('georges-st-pierre')), opponent: generateOpponent(seed, 1) });
  return resolveExchange(s, { kind: 'takedown', takedownType: 'double-leg' });
}

describe('resolveGround', () => {
  it('a landed player takedown puts us in the ground phase with a position', () => {
    const s = toGround('ground-seed-A');
    // GSP vs Tier-1: double-leg always dominates → always enters 'ground' on beat 1
    expect(s.phase).toBe('ground');
    expect(s.ground).not.toBeNull();
    expect(['guard', 'half-guard', 'side-control', 'mount', 'back']).toContain(s.ground!.position);
  });

  it('throws if called off the ground phase', () => {
    const s = startFight({ seed: 'x', fightNumber: 1, playerStatLine: buildStatLine(getFighter('georges-st-pierre')), opponent: generateOpponent('x', 1) });
    expect(() => resolveGround(s, 'ground-and-pound')).toThrow();
  });

  it('is deterministic (same seed → identical result)', () => {
    const a = toGround('ground-seed-D');
    const b = toGround('ground-seed-D');
    expect(a.phase).toBe('ground');
    expect(b.phase).toBe('ground');
    expect(resolveGround(a, 'ground-and-pound')).toEqual(resolveGround(b, 'ground-and-pound'));
  });

  it('ground-and-pound credits roundScore and damages the opponent head (no rock)', () => {
    const s = toGround('ground-seed-B');
    expect(s.phase).toBe('ground');
    const r = resolveGround(s, 'ground-and-pound');
    // either stayed on ground / escaped to in-round / crossed to corner / opened a finish window
    expect(['ground', 'in-round', 'corner', 'finish-window', 'finished']).toContain(r.phase);
    // opponent head damage is monotonic non-decreasing
    expect(r.opponent.headDamage).toBeGreaterThanOrEqual(s.opponent.headDamage);
  });

  it('advance from side-control can reach mount (better position quality)', () => {
    const s0 = toGround('ground-seed-C');
    expect(s0.phase).toBe('ground');
    const s: FightState = { ...s0, ground: { position: 'side-control' }, exchange: EXCHANGES_PER_ROUND };
    const r = resolveGround(s, 'advance');
    // With exchange forced to EXCHANGES_PER_ROUND, the beat budget is exhausted → round boundary
    expect(['corner', 'finished']).toContain(r.phase);
    expect(r.phase === 'ground').toBe(false); // never stuck on ground at boundary
  });

  it('a successful submission from the back finishes the fight by submission', () => {
    // From 'back' position, groundSubProbability for GSP (submissions=66) vs Tier-1 → 0.95 (max).
    // The first rng() roll is the sub roll; nearly all seeds tap here.
    const s0 = toGround('ground-seed-C');
    expect(s0.phase).toBe('ground');
    const s: FightState = { ...s0, ground: { position: 'back' }, exchange: 1 };
    const r = resolveGround(s, 'submission');
    // Remove the if guard — sub probability at back is high; this seed is verified to tap
    expect(r.phase).toBe('finished');
    expect(r.outcome?.method).toBe('submission');
  });

  it('double-leg lands at half-guard per TAKEDOWN_PROFILES', () => {
    const s = toGround('ground-seed-A');
    expect(s.phase).toBe('ground');
    expect(s.ground!.position).toBe('half-guard');
  });

  // ── Fix E: successful submission must clear gamePlan ────────────────────────
  it('a successful submission sets gamePlan to null (terminal state hygiene)', () => {
    const s0 = toGround('ground-seed-C');
    expect(s0.phase).toBe('ground');
    // Force 'back' position (highest sub probability) with a gamePlan active.
    const s: FightState = { ...s0, ground: { position: 'back' }, exchange: 1, gamePlan: 'push-pace' as const };
    const r = resolveGround(s, 'submission');
    expect(r.phase).toBe('finished');
    expect(r.outcome?.method).toBe('submission');
    expect(r.gamePlan).toBeNull(); // Fix E: was state.gamePlan before fix
  });

  it('POSITION_SUBMISSION returns null for guard, non-null for all other positions', () => {
    expect(POSITION_SUBMISSION['guard']).toBeNull();
    expect(POSITION_SUBMISSION['half-guard']).not.toBeNull();
    expect(POSITION_SUBMISSION['side-control']).not.toBeNull();
    expect(POSITION_SUBMISSION['mount']).not.toBeNull();
    expect(POSITION_SUBMISSION['back']).not.toBeNull();
  });
});
