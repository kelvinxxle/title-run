import { describe, it, expect } from 'vitest';
import { startFight, roundsForFight, opponentIntent } from './fightState';
import type { FightState, RoundLogEntry } from './fightState';
import { ARCHETYPES } from './archetypes';

const OPP = { id: 'o1', name: 'Test Foe', archetype: 'wrestler' as const, statLine: ARCHETYPES.wrestler };

describe('fight state', () => {
  it('title fight and defenses are 5 rounds, others 3', () => {
    expect(roundsForFight(1)).toBe(3);
    expect(roundsForFight(5)).toBe(5);
    expect(roundsForFight(7)).toBe(5);
  });
  it('starts fresh: full stamina, zero damage, round 1, in-round', () => {
    const s = startFight({ seed: 'x', fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: OPP });
    expect(s.round).toBe(1);
    expect(s.phase).toBe('in-round');
    expect(s.player.headDamage).toBe(0);
    expect(s.player.stamina).toBe(100);
    expect(s.opponent.stamina).toBe(100);
    expect(s.outcome).toBeNull();
  });
  it('a wrestler AI prefers to wrestle and is deterministic', () => {
    const s = startFight({ seed: 'x', fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: OPP });
    expect(opponentIntent(s).kind).toBe('wrestle');
    expect(opponentIntent(s)).toEqual(opponentIntent(s));
  });
});

// ── T1: Feature A — adaptive counter-reading opponentIntent ──────────────────
//
// Seed probes (verified via createRng offline):
//   'adaptive-ai', fn=1, round=4  → roll=0.115704
//     • IQ=94, pred=1.0 → counterChance=0.322  (0.115704 < 0.322  → counter)
//     • IQ=54, pred=1.0 → counterChance=0.050  (0.115704 ≥ 0.050  → pickApart)
//     • IQ=94, pred=0   → counterChance=0.050  (0.115704 ≥ 0.050  → pickApart)
//   'mono-test-5', fn=1, round=4  → roll=0.186700
//     • IQ=94, pred=1/3 → counterChance=0.1407 (0.186700 ≥ 0.1407 → pickApart)
//     • IQ=94, pred=2/3 → counterChance=0.2313 (0.186700 < 0.2313 → counter)
//
// The brawler archetype takes the striking branch when playing ARCHETYPES.striker:
//   strikeEdge=82−74=8  wrestleEdge=46−66=−20  (8 > −20 → striking path)

describe('opponentIntent: Feature A adaptive counter-reading (T1)', () => {
  const highIqStatLine = { ...ARCHETYPES.brawler, fightIQ: 94 };
  const lowIqStatLine  = { ...ARCHETYPES.brawler, fightIQ: 54 };
  const highIqOpp = { id: 'hiq', name: 'Smart Foe', archetype: 'brawler' as const, statLine: highIqStatLine };
  const lowIqOpp  = { id: 'loq', name: 'Dumb Foe',  archetype: 'brawler' as const, statLine: lowIqStatLine  };

  const pressureEntry = (round: number): RoundLogEntry => ({
    round,
    playerIntent: { kind: 'strike', target: 'head', tactic: 'pressure' },
    opponentIntent: { kind: 'strike', target: 'head', tactic: 'pickApart' },
    winner: 'player',
    dominance: 5,
  });

  const nonPressureEntry = (round: number): RoundLogEntry => ({
    round,
    playerIntent: { kind: 'strike', target: 'head', tactic: 'pickApart' },
    opponentIntent: { kind: 'strike', target: 'head', tactic: 'pressure' },
    winner: 'opponent',
    dominance: -5,
  });

  function makeAdaptiveState(
    opp: { id: string; name: string; archetype: 'brawler'; statLine: typeof highIqStatLine },
    log: RoundLogEntry[],
    seed = 'adaptive-ai',
    round = 4,
  ): FightState {
    const base = startFight({ seed, fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: opp });
    return { ...base, round, log };
  }

  it('T1.1 high-IQ (94) + ≥3 pressure rounds → returns counter (was pickApart before T1)', () => {
    // Before T1: roll=0.115704, fn=1, aggression=0, roll<0.5 → always 'pickApart'.
    // After T1:  counterChance=0.322, roll<0.322                → 'counter'.
    const state = makeAdaptiveState(highIqOpp, [
      pressureEntry(1), pressureEntry(2), pressureEntry(3),
    ]);
    expect(opponentIntent(state)).toEqual({ kind: 'strike', target: 'head', tactic: 'counter' });
  });

  it('T1.2 low-IQ (54) + same pressure log → stays near baseline, NOT counter', () => {
    // IQ_MID=60, fightIQ=54 → readBonus=0 → counterChance=BASE=0.05
    // roll=0.115704 ≥ 0.05 → gate does not fire → falls through to old distribution → pickApart
    const state = makeAdaptiveState(lowIqOpp, [
      pressureEntry(1), pressureEntry(2), pressureEntry(3),
    ]);
    const intent = opponentIntent(state);
    expect(intent.kind).toBe('strike');
    expect((intent as Extract<typeof intent, { kind: 'strike' }>).tactic).not.toBe('counter');
  });

  it('T1.3 fair-play: empty log + high-IQ → predictability=0, adaptive gate does NOT fire', () => {
    // Same seed/round as T1.1, but log is empty.
    // predictability=0 → counterChance=BASE=0.05 → roll=0.115704 ≥ 0.05 → no override.
    const state = makeAdaptiveState(highIqOpp, []);
    const intent = opponentIntent(state);
    expect(intent.kind).toBe('strike');
    expect((intent as Extract<typeof intent, { kind: 'strike' }>).tactic).not.toBe('counter');
  });

  it('T1.4 determinism: same state → identical intent on both calls', () => {
    const state = makeAdaptiveState(highIqOpp, [
      pressureEntry(1), pressureEntry(2), pressureEntry(3),
    ]);
    expect(opponentIntent(state)).toEqual(opponentIntent(state));
  });

  it('T1.5 monotonic: 2/3 pressure fires counter where 1/3 pressure does not (more = higher chance)', () => {
    // seed='mono-test-5', fn=1, round=4 → roll=0.186700
    //   1/3 pressure → counterChance≈0.1407 → 0.186700 ≥ 0.1407 → NOT counter
    //   2/3 pressure → counterChance≈0.2313 → 0.186700 < 0.2313 → counter
    const monoOpp = { id: 'mq', name: 'Mono Foe', archetype: 'brawler' as const, statLine: highIqStatLine };
    const oneOfThree: RoundLogEntry[] = [pressureEntry(1), nonPressureEntry(2), nonPressureEntry(3)];
    const twoOfThree: RoundLogEntry[] = [pressureEntry(1), pressureEntry(2), nonPressureEntry(3)];
    const base = startFight({ seed: 'mono-test-5', fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: monoOpp });
    const state1 = { ...base, round: 4, log: oneOfThree };
    const state2 = { ...base, round: 4, log: twoOfThree };
    const i1 = opponentIntent(state1);
    const i2 = opponentIntent(state2);
    expect((i1 as Extract<typeof i1, { kind: 'strike' }>).tactic).not.toBe('counter');
    expect(i2).toEqual({ kind: 'strike', target: 'head', tactic: 'counter' });
  });

  it('T1.6 short-log guard: single pressure entry in 3-round window returns predictability 0', () => {
    // Bug fix: with log.length < n guard, a 1-entry log should return 0 predictability.
    // Before fix: 1/1 = 1.0 (high-IQ opp reads counter prematurely on rounds 2-3).
    // After fix:  1 < 3 → return 0 (fair-play: need at least n rounds of data).
    const state = makeAdaptiveState(highIqOpp, [pressureEntry(1)]);
    // With predictability=0, counterChance ≈ 0.05, so the counter gate should not fire.
    // The tactic will fall through to the normal distribution (pickApart or other).
    const intent = opponentIntent(state);
    expect(intent.kind).toBe('strike');
    expect((intent as Extract<typeof intent, { kind: 'strike' }>).tactic).not.toBe('counter');
  });
});
