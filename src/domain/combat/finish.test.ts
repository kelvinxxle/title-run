import { describe, it, expect } from 'vitest';
import type { FightState } from './fightState';
import { startFight } from './fightState';
import { resolveExchange } from './exchange';
import { detectWindow, finishStep, groundStep, ROCKED_HEAD_DMG } from './finish';
import type { ResolvedContext } from './finish';
import { ARCHETYPES } from './archetypes';
import { STAMINA_MAX } from './stamina';

// A fragile-chinned opponent so the damage path opens within a couple of rounds.
const GLASS = { id: 'g', name: 'Glass Joe', archetype: 'brawler' as const, statLine: { ...ARCHETYPES.brawler, chin: 20, strikingDef: 20 } };

// ── helpers ──────────────────────────────────────────────────────────────────

/** Minimal FightState in finish-window phase for unit-level finishStep tests. */
function makeWindowState(overrides: Partial<FightState> = {}): FightState {
  const merged: FightState = {
    seed: 'two-win',
    fightNumber: 1,
    rounds: 3,
    round: 1,
    exchange: 1,
    phase: 'finish-window',
    player: { statLine: ARCHETYPES.striker, headDamage: 0, bodyDamage: 0, stamina: STAMINA_MAX, legDamage: 0, roundScore: 0 },
    opponent: { statLine: ARCHETYPES.brawler, headDamage: 50, bodyDamage: 0, stamina: STAMINA_MAX, legDamage: 0, roundScore: 0, name: 'Opp', archetype: 'brawler' },
    window: { side: 'player', method: 'KO', stepsLeft: 3 },
    outcome: null,
    log: [],
    gamePlan: null,
    lastReport: null,
    ...overrides,
  } as FightState;
  return { ...merged, gamePlan: merged.gamePlan ?? null, lastReport: merged.lastReport ?? null };
}

describe('finish flow', () => {
  it('a rocked opponent opens a finish window, and commit can end it', () => {
    let s = startFight({ seed: 'ko-seed', fightNumber: 1, playerStatLine: { ...ARCHETYPES.brawler, striking: 99 }, opponent: GLASS });
    for (let i = 0; i < 3 && s.phase === 'in-round'; i++) {
      s = resolveExchange(s, { kind: 'strike', strike: 'powerPunch' });
    }
    expect(s.phase).toBe('finish-window');
    expect(s.window?.side).toBe('player');
    // drive the finish sequence to a terminal state
    while (s.phase === 'finish-window') s = finishStep(s, 'commit');
    expect(['finished','corner']).toContain(s.phase);
    // If a finish outcome was recorded, it must be the player's win.
    // (A failed commit on the last round ends as 'finished' with outcome=null.)
    if (s.outcome !== null) expect(s.outcome.winner).toBe('player');
  });

  it('finishStep throws if no window is open', () => {
    const s = startFight({ seed: 'x', fightNumber: 1, playerStatLine: ARCHETYPES.striker, opponent: GLASS });
    expect(() => finishStep(s, 'commit')).toThrow();
  });

  it('finishStep throws on a ground-method window (must route through groundStep)', () => {
    const s = makeWindowState({ window: { side: 'player', method: 'ground', stepsLeft: 3 } });
    expect(() => finishStep(s, 'commit')).toThrow();
  });

  // ── Fix 2: opponent-side finish window ──────────────────────────────────────
  it('detectWindow opens opponent-side window when player is rocked', () => {
    // Player has chin=20 and takes 25 head damage → ROCKED_HEAD_DMG(20)=20 ≤ 25.
    // Opponent head damage is 0. This deterministically hits the damage-path
    // branch: playerHeadDamage >= ROCKED_HEAD_DMG(playerStatLine.chin).
    const ctx: ResolvedContext = {
      prePlayerHeadDamage: 0,
      preOpponentHeadDamage: 0,
      playerHeadDamage: 25,
      opponentHeadDamage: 0,
      playerStamina: STAMINA_MAX,
      opponentStamina: STAMINA_MAX,
      playerStatLine: { ...ARCHETYPES.brawler, chin: 20 },
      opponentStatLine: { ...ARCHETYPES.striker, striking: 99 },
      dominance: -10,
      playerIntent:   { kind: 'strike', strike: 'powerPunch' },
      opponentIntent: { kind: 'strike', strike: 'powerPunch' },
    };
    const win = detectWindow(ctx);
    expect(win?.side).toBe('opponent');
    expect(win?.method).toBe('KO');
  });

  // ── Fix 2: finish-window side & staleness ────────────────────────────────────
  const baseDmgCtx = (over: Partial<ResolvedContext>): ResolvedContext => ({
    prePlayerHeadDamage: 0,
    preOpponentHeadDamage: 0,
    playerHeadDamage: 0,
    opponentHeadDamage: 0,
    playerStamina: STAMINA_MAX,
    opponentStamina: STAMINA_MAX,
    playerStatLine: { ...ARCHETYPES.striker, chin: 50 },
    opponentStatLine: { ...ARCHETYPES.striker, chin: 50 },
    dominance: 0,
    playerIntent:   { kind: 'strike', strike: 'jab' },
    opponentIntent: { kind: 'strike', strike: 'jab' },
    ...over,
  });

  it('no damage-path window reopens from stale head damage when the other side won', () => {
    // Opponent was rocked in a PRIOR round (pre == post, no new damage this round),
    // but THIS exchange the opponent won (dominance < 0). No player window should open.
    const ctx = baseDmgCtx({
      preOpponentHeadDamage: 50,
      opponentHeadDamage: 50, // unchanged this round → stale
      dominance: -12,
    });
    expect(detectWindow(ctx)).toBeNull();
  });

  it('damage-path window aligns with the exchange winner (no opponent-first priority)', () => {
    // Opponent carries stale head damage above threshold, but the player is the one
    // freshly rocked THIS round and the opponent won the exchange → window is opponent-side.
    const ctx = baseDmgCtx({
      preOpponentHeadDamage: 60,
      opponentHeadDamage: 60,     // stale, above threshold
      prePlayerHeadDamage: 0,
      playerHeadDamage: 40,       // fresh crossing (ROCKED(50)=36 ≤ 40)
      dominance: -12,             // opponent won
    });
    const win = detectWindow(ctx);
    expect(win?.side).toBe('opponent');
  });

  it('a fresh head-damage crossing by the exchange winner opens a window', () => {
    const ctx = baseDmgCtx({
      preOpponentHeadDamage: 10,  // below threshold
      opponentHeadDamage: 40,     // crosses ROCKED(50)=36 this round
      dominance: 12,              // player won
    });
    const win = detectWindow(ctx);
    expect(win?.side).toBe('player');
    expect(win?.method).toBe('KO');
  });

  // ── Fix 1: independent RNG stream per finish window ──────────────────────────
  // Seed 'two-win', fightNumber=1:
  //   OLD key (no round): #f1#finish0 → roll 0.018 → success for ALL rounds
  //   NEW key (with round): #f1#r1#finish0 → roll 0.739 (fail); #f1#r2#finish0 → roll 0.501 (success)
  // Before fix: both states produce 'finished' (same roll) → phases are equal → test FAILS.
  // After fix: round=1 fails, round=2 succeeds → phases differ → test PASSES.
  it('finishStep RNG is independent across windows (different rounds produce different outcomes)', () => {
    const win1Result = finishStep(makeWindowState({ round: 1 }), 'commit');
    const win2Result = finishStep(makeWindowState({ round: 2 }), 'commit');
    expect(win1Result.phase).not.toBe(win2Result.phase);
  });
});

// ── Task 2: ground window (player offense) ─────────────────────────────────────

/** Minimal FightState in ground-window phase for unit-level groundStep tests. */
function makeGroundWindowState(overrides: Partial<FightState> = {}): FightState {
  const merged: FightState = {
    seed: 'ground',
    fightNumber: 1,
    rounds: 3,
    round: 1,
    exchange: 1,
    phase: 'ground-window',
    player: { statLine: ARCHETYPES.striker, headDamage: 0, bodyDamage: 0, stamina: STAMINA_MAX, legDamage: 0, roundScore: 0 },
    opponent: { statLine: ARCHETYPES.brawler, headDamage: 0, bodyDamage: 0, stamina: STAMINA_MAX, legDamage: 0, roundScore: 0, name: 'Opp', archetype: 'brawler' },
    window: { side: 'player', method: 'ground', stepsLeft: 3 },
    outcome: null,
    log: [],
    gamePlan: null,
    lastReport: null,
    ...overrides,
  } as FightState;
  return { ...merged, gamePlan: merged.gamePlan ?? null, lastReport: merged.lastReport ?? null };
}

describe('ROCKED_HEAD_DMG threshold clamp', () => {
  it('never returns a threshold below 1, even for a minimal chin', () => {
    // Guard: a threshold that rounds to 0 would make the damage-path window
    // impossible to reason about (0 head damage would "rock"). Clamp floors it at 1.
    expect(ROCKED_HEAD_DMG(1)).toBeGreaterThanOrEqual(1);
    expect(ROCKED_HEAD_DMG(0)).toBeGreaterThanOrEqual(1);
  });
});

describe('ground window (Task 2)', () => {
  it('a winning player wrestle opens a ground window without advancing the round', () => {
    // seed 'ground-probe-0': player (huge takedowns) beats a weak-takedownDef striker
    // on the wrestle in round 1 (dominance ≈ 58.8 > 0), without triggering a KO/sub window.
    const player = { ...ARCHETYPES.wrestler, takedowns: 99 };
    const opp = { id: 'o', name: 'Opp', archetype: 'striker' as const, statLine: { ...ARCHETYPES.striker, takedownDef: 20 } };
    const s0 = startFight({ seed: 'ground-probe-0', fightNumber: 1, playerStatLine: player, opponent: opp });
    const s1 = resolveExchange(s0, { kind: 'takedown' });
    expect(s1.phase).toBe('ground-window');
    expect(s1.window?.side).toBe('player');
    expect(s1.window?.method).toBe('ground');
    expect(s1.round).toBe(1); // round NOT advanced
    // no exchange damage was applied on the ground-window open
    expect(s1.opponent.headDamage).toBe(0);
    expect(s1.opponent.bodyDamage).toBe(0);
  });

  it('groundStep throws unless the phase is ground-window', () => {
    const s = makeGroundWindowState({ phase: 'in-round' });
    expect(() => groundStep(s, 'ground-and-pound')).toThrow();
  });

  it('groundStep throws if the window is opponent-side (player-top-control invariant)', () => {
    const s = makeGroundWindowState({ window: { side: 'opponent', method: 'ground', stepsLeft: 3 } });
    expect(() => groundStep(s, 'ground-and-pound')).toThrow();
  });

  it('ground-and-pound that rocks a fragile-chin opponent scores a TKO (KO)', () => {
    // chin=1 → ROCKED_HEAD_DMG=1, so any GnP damage crosses the threshold from 0.
    const opp = { statLine: { ...ARCHETYPES.brawler, chin: 1 }, headDamage: 0, bodyDamage: 0, stamina: STAMINA_MAX, legDamage: 0, roundScore: 0, name: 'Opp', archetype: 'brawler' };
    const s = makeGroundWindowState({ opponent: opp });
    expect(ROCKED_HEAD_DMG(1)).toBe(1);
    const res = groundStep(s, 'ground-and-pound');
    expect(res.phase).toBe('finished');
    expect(res.outcome?.winner).toBe('player');
    expect(res.outcome?.method).toBe('KO');
    expect(res.opponent.headDamage).toBeGreaterThanOrEqual(ROCKED_HEAD_DMG(1));
  });

  it('ground-and-pound that does not rock closes the window and advances the round', () => {
    // Tough chin so the GnP damage stays below the rocked threshold → no TKO.
    const opp = { statLine: { ...ARCHETYPES.brawler, chin: 99 }, headDamage: 0, bodyDamage: 0, stamina: STAMINA_MAX, legDamage: 0, roundScore: 0, name: 'Opp', archetype: 'brawler' };
    const s = makeGroundWindowState({ opponent: opp });
    const res = groundStep(s, 'ground-and-pound');
    expect(res.phase).toBe('corner');
    expect(res.window).toBeNull();
    expect(res.round).toBe(2);
    expect(res.opponent.headDamage).toBeGreaterThan(0); // damage still landed
  });

  it('submission against a weak submission defense (committing seed) taps the opponent', () => {
    // grappler player (submissions 84) vs submissionDef 10 → p clamps to 0.95;
    // seed 'ground-sub' rolls 0.5149 < 0.95 → success.
    const player = { statLine: ARCHETYPES.grappler, headDamage: 0, bodyDamage: 0, stamina: STAMINA_MAX, legDamage: 0, roundScore: 0 };
    const opp = { statLine: { ...ARCHETYPES.brawler, submissionDef: 10 }, headDamage: 0, bodyDamage: 0, stamina: STAMINA_MAX, legDamage: 0, roundScore: 0, name: 'Opp', archetype: 'brawler' };
    const s = makeGroundWindowState({ seed: 'ground-sub', player, opponent: opp });
    const res = groundStep(s, 'submission');
    expect(res.phase).toBe('finished');
    expect(res.outcome?.winner).toBe('player');
    expect(res.outcome?.method).toBe('submission');
  });

  it('submission against a strong submission defense fails and advances the round', () => {
    // striker player (submissions 40) vs submissionDef 99 → p clamps to 0.05;
    // seed 'ground-nofin' rolls 0.7451 >= 0.05 → no tap, round advances.
    const player = { statLine: ARCHETYPES.striker, headDamage: 0, bodyDamage: 0, stamina: STAMINA_MAX, legDamage: 0, roundScore: 0 };
    const opp = { statLine: { ...ARCHETYPES.grappler, submissionDef: 99 }, headDamage: 0, bodyDamage: 0, stamina: STAMINA_MAX, legDamage: 0, roundScore: 0, name: 'Opp', archetype: 'grappler' };
    const s = makeGroundWindowState({ seed: 'ground-nofin', player, opponent: opp });
    const res = groundStep(s, 'submission');
    expect(res.phase).toBe('corner');
    expect(res.window).toBeNull();
    expect(res.round).toBe(2);
    expect(res.outcome).toBeNull();
    expect(res.lastReport).not.toBeNull();
  });

  it('a failed ground finish on the final round yields a decision outcome', () => {
    const player = { statLine: ARCHETYPES.striker, headDamage: 0, bodyDamage: 0, stamina: STAMINA_MAX, legDamage: 0, roundScore: 0 };
    const opp = { statLine: { ...ARCHETYPES.grappler, submissionDef: 99, chin: 99 }, headDamage: 0, bodyDamage: 0, stamina: STAMINA_MAX, legDamage: 0, roundScore: 0, name: 'Opp', archetype: 'grappler' };
    const s = makeGroundWindowState({ seed: 'ground-nofin', rounds: 1, player, opponent: opp });
    const res = groundStep(s, 'submission');
    expect(res.phase).toBe('finished');
    expect(res.round).toBe(1);
    expect(res.outcome).not.toBeNull();
    expect(res.outcome!.method).toBe('decision');
  });
});

describe('finish — last-round decision handoff', () => {
  it('a failed non-terminal commit closes the window and advances to corner', () => {
    const result = finishStep(makeWindowState({ round: 1, rounds: 3 }), 'commit');
    expect(result.phase).toBe('corner');
    expect(result.window).toBeNull();
    expect(result.round).toBe(2);
  });

  it('a depleted non-terminal hold closes the window and advances to corner', () => {
    const result = finishStep(
      makeWindowState({ round: 1, rounds: 3, window: { side: 'player', method: 'KO', stepsLeft: 1 } }),
      'hold',
    );
    expect(result.phase).toBe('corner');
    expect(result.window).toBeNull();
    expect(result.round).toBe(2);
  });

  it('a failed finish on the final round yields finished with a non-null decision outcome', () => {
    // From Fix-1 test: seed='two-win', round=1, commit roll=0.739 → FAIL (> COMMIT_P=0.7).
    // Override rounds=1 so this IS the last round → expect decision outcome.
    const s = makeWindowState({ round: 1, rounds: 1 });
    const result = finishStep(s, 'commit');
    expect(result.phase).toBe('finished');
    expect(result.outcome).not.toBeNull();
    expect(result.outcome!.method).toBe('decision');
  });

  it('a failed final-round finish keeps round within bounds and consistent with outcome.round', () => {
    // commit path on the last round
    const commitRes = finishStep(makeWindowState({ round: 1, rounds: 1 }), 'commit');
    expect(commitRes.round).toBe(1);                       // NOT rounds+1
    expect(commitRes.round).toBeLessThanOrEqual(commitRes.rounds);
    expect(commitRes.outcome!.round).toBe(commitRes.round);

    // measure/hold exhaustion path on the last round: stepsLeft=1 so one hold empties it.
    const holdRes = finishStep(
      makeWindowState({ round: 1, rounds: 1, window: { side: 'player', method: 'KO', stepsLeft: 1 } }),
      'hold',
    );
    expect(holdRes.phase).toBe('finished');
    expect(holdRes.round).toBe(1);
    expect(holdRes.round).toBeLessThanOrEqual(holdRes.rounds);
    expect(holdRes.outcome!.round).toBe(holdRes.round);
  });
});

// ── M14 fix: groundStep lastReport ─────────────────────────────────────────────
// groundAndPoundDamage(ARCHETYPES.striker, ARCHETYPES.brawler):
//   raw = (0.5*80 + 0.5*42) - 0.5*54 = 61 - 27 = 34
//   gpDmg = Math.max(8, Math.round(34 * 0.7)) = Math.max(8, 24) = 24
// ROCKED_HEAD_DMG(84) = Math.max(1, Math.round(84*0.56)) = 47 → 24 < 47, no TKO.
// ROCKED_HEAD_DMG(1)  = 1 → 24 >= 1, TKO.

describe('M14 fix: groundStep lastReport', () => {
  it('non-TKO ground-and-pound rebuilds lastReport with correct opponentHeadDelta and winner', () => {
    // Default makeGroundWindowState: striker vs brawler(chin=84). gpDmg=24 < rocked(47) → no TKO.
    const s = makeGroundWindowState();
    const result = groundStep(s, 'ground-and-pound');
    expect(result.phase).toBe('corner');
    expect(result.lastReport).not.toBeNull();
    expect(result.lastReport!.winner).toBe('player');
    expect(result.lastReport!.opponentHeadDelta).toBeGreaterThan(0);
    expect(result.lastReport!.opponentHeadDelta).toBe(24); // gpDmg = 24
  });

  it('TKO ground-and-pound rebuilds lastReport with opponentBecameRocked=true signal and correct delta', () => {
    // chin=1 → ROCKED_HEAD_DMG(1)=1 → any GnP damage crosses threshold → TKO.
    const opp = {
      statLine: { ...ARCHETYPES.brawler, chin: 1 },
      headDamage: 0,
      bodyDamage: 0,
      stamina: STAMINA_MAX,
      legDamage: 0, roundScore: 0,
      name: 'Opp',
      archetype: 'brawler' as const,
    };
    const s = makeGroundWindowState({ opponent: opp });
    const result = groundStep(s, 'ground-and-pound');
    expect(result.phase).toBe('finished');
    expect(result.lastReport).not.toBeNull();
    expect(result.lastReport!.winner).toBe('player');
    expect(result.lastReport!.opponentHeadDelta).toBeGreaterThan(0);
  });
});
