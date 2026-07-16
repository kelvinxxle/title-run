import { describe, it, expect } from 'vitest';
import { startFight, roundsForFight, opponentMove, computePredictability } from './fightState';
import type { FightState, RoundLogEntry } from './fightState';
import { STRIKES } from './strikes';
import { ARCHETYPES } from './archetypes';
import { generateOpponent } from './opponent';
import { buildStatLine, getFighter } from './roster';
import { opponentTakedownType } from './takedown';
import type { ArchetypeId } from './archetypes';

const OPP = { id: 'o1', name: 'Test Foe', archetype: 'wrestler' as const, statLine: ARCHETYPES.wrestler };

describe('fight state', () => {
  it('title fight and defenses are 5 rounds, others 3', () => {
    expect(roundsForFight(1)).toBe(3);
    expect(roundsForFight(5)).toBe(5);
    expect(roundsForFight(7)).toBe(5);
  });
  it('starts fresh: full stamina, zero damage, round 1, exchange 1, in-round', () => {
    const s = startFight({ seed: 'x', fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: OPP });
    expect(s.round).toBe(1);
    expect(s.exchange).toBe(1);
    expect(s.phase).toBe('in-round');
    expect(s.player.headDamage).toBe(0);
    expect(s.player.stamina).toBe(100);
    expect(s.opponent.stamina).toBe(100);
    expect(s.outcome).toBeNull();
  });
  it('a wrestler AI prefers a takedown and is deterministic', () => {
    const s = startFight({ seed: 'x', fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: OPP });
    expect(opponentMove(s).kind).toBe('takedown');
    expect(opponentMove(s)).toEqual(opponentMove(s));
  });
});

// ── T3: opponent palette AI (opponentMove) ─────────────────────────────────────

describe('opponentMove', () => {
  const strikerOpp = { id: 's', name: 'Striker Foe', archetype: 'striker' as const, statLine: ARCHETYPES.striker };

  it('is deterministic for a fixed seed / fight / round / exchange', () => {
    const s = startFight({ seed: 'ai-seed', fightNumber: 3, playerStatLine: ARCHETYPES.striker, opponent: strikerOpp });
    expect(opponentMove(s)).toEqual(opponentMove(s));
  });

  it('returns a strike move from the palette or a takedown', () => {
    const s = startFight({ seed: 'ai-seed', fightNumber: 3, playerStatLine: ARCHETYPES.striker, opponent: strikerOpp });
    const m = opponentMove(s);
    if (m.kind === 'strike') expect(STRIKES[m.strike]).toBeDefined();
    else expect(m.kind).toBe('takedown');
  });

  it('digs to the body when the player is gassed (striking-edge opponent)', () => {
    const base = startFight({ seed: 'gassed-ai', fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: strikerOpp });
    const gassed: FightState = { ...base, player: { ...base.player, stamina: 5 } };
    expect(opponentMove(gassed)).toEqual({ kind: 'strike', strike: 'bodyKick' });
  });
});

describe('computePredictability (head-hunting)', () => {
  const beat = (playerStrike: 'powerPunch' | 'jab' | 'elbow'): RoundLogEntry => ({
    round: 1,
    exchange: 1,
    playerIntent: { kind: 'strike', strike: playerStrike },
    opponentIntent: { kind: 'strike', strike: 'jab' },
    winner: 'player',
    dominance: 5,
  });

  it('is 0 with fewer than n beats', () => {
    expect(computePredictability([], 3)).toBe(0);
    expect(computePredictability([beat('powerPunch'), beat('powerPunch')], 3)).toBe(0);
  });

  it('is 1.0 when the last n beats are all head power strikes', () => {
    expect(computePredictability([beat('powerPunch'), beat('powerPunch'), beat('powerPunch')], 3)).toBe(1);
  });

  it('counts elbow (koWeight 1.0) as a head-hunt', () => {
    expect(computePredictability([beat('elbow'), beat('elbow'), beat('elbow')], 3)).toBe(1);
  });

  it('is 0 when the player mixes in only non-KO strikes', () => {
    expect(computePredictability([beat('jab'), beat('jab'), beat('jab')], 3)).toBe(0);
  });
});

describe('M16: opponentMove takedownType', () => {
  it('tags takedowns with the archetype-preferred type (no extra rng draw)', () => {
    const st = startFight({
      seed: 'td-type-seed', fightNumber: 1,
      playerStatLine: buildStatLine(getFighter('georges-st-pierre')),
      opponent: generateOpponent('td-type-seed', 4),
    });
    const mv = opponentMove(st);
    if (mv.kind === 'takedown') {
      expect(mv.takedownType).toBe(opponentTakedownType(st.opponent.archetype as ArchetypeId));
    }
  });
});
