import { describe, it, expect } from 'vitest';
import type { FightState } from './fightState';
import { startFight } from './fightState';
import { resolveExchange } from './exchange';
import { detectWindow, finishStep } from './finish';
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
    ground: null,
    signatureId: 'check-hook',
    signatureCharge: 0,
    beats: [],
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

// ── I1 RED: successful finishStep must emit a beat with isFinish=true ─────────
// makeWindowState({ round:2 }) hits the SUCCESS path (roll=0.501 < COMMIT_P=0.7).
// Before fix: beats=[]; after fix: beats=[finishBeat].
describe('I1: finishStep beat emission', () => {
  it('I1 — successful finishStep emits a beat with isFinish=true (domain-only)', () => {
    const after = finishStep(makeWindowState({ round: 2 }), 'commit');
    expect(after.phase).toBe('finished');
    expect(after.outcome?.winner).toBe('player');
    const koBeats = after.beats.filter(b => b.isFinish);
    expect(koBeats.length).toBeGreaterThanOrEqual(1);
    expect(koBeats[0].isFinish).toBe(true);
    expect(koBeats[0].finishMethod).toBe('KO');
    expect(koBeats[0].actorId).toBe('player');
  });
});

