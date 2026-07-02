import { describe, it, expect } from 'vitest';
import type { FightState } from './fightState';
import { startFight } from './fightState';
import { resolveRound } from './resolve';
import { detectWindow, finishStep } from './finish';
import type { ResolvedContext } from './finish';
import { ARCHETYPES } from './archetypes';
import { STAMINA_MAX } from './stamina';

// A fragile-chinned opponent so the damage path opens within a couple of rounds.
const GLASS = { id: 'g', name: 'Glass Joe', archetype: 'brawler' as const, statLine: { ...ARCHETYPES.brawler, chin: 20, strikingDef: 20 } };

// ── helpers ──────────────────────────────────────────────────────────────────

/** Minimal FightState in finish-window phase for unit-level finishStep tests. */
function makeWindowState(overrides: Partial<FightState> = {}): FightState {
  return {
    seed: 'two-win',
    fightNumber: 1,
    rounds: 3,
    round: 1,
    phase: 'finish-window',
    player: { statLine: ARCHETYPES.striker, headDamage: 0, bodyDamage: 0, stamina: STAMINA_MAX, roundScore: 0 },
    opponent: { statLine: ARCHETYPES.brawler, headDamage: 50, bodyDamage: 0, stamina: STAMINA_MAX, roundScore: 0, name: 'Opp', archetype: 'brawler' },
    window: { side: 'player', method: 'KO', stepsLeft: 3 },
    outcome: null,
    log: [],
    ...overrides,
  };
}

describe('finish flow', () => {
  it('a rocked opponent opens a finish window, and commit can end it', () => {
    let s = startFight({ seed: 'ko-seed', fightNumber: 1, playerStatLine: { ...ARCHETYPES.brawler, striking: 99 }, opponent: GLASS });
    for (let i = 0; i < 3 && s.phase === 'in-round'; i++) {
      s = resolveRound(s, { where: 'strike', target: 'head', approach: 'pressure' });
    }
    expect(s.phase).toBe('finish-window');
    expect(s.window?.side).toBe('player');
    // drive the finish sequence to a terminal state
    while (s.phase === 'finish-window') s = finishStep(s, 'commit');
    expect(['finished','in-round']).toContain(s.phase);
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
      playerHeadDamage: 25,
      opponentHeadDamage: 0,
      playerStamina: STAMINA_MAX,
      opponentStamina: STAMINA_MAX,
      playerStatLine: { ...ARCHETYPES.brawler, chin: 20 },
      opponentStatLine: { ...ARCHETYPES.striker, striking: 99 },
      dominance: -10,
      playerIntent:   { where: 'strike', target: 'head', approach: 'pressure' },
      opponentIntent: { where: 'strike', target: 'head', approach: 'pressure' },
    };
    const win = detectWindow(ctx);
    expect(win?.side).toBe('opponent');
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
  it('a failed finish on the final round yields finished with a non-null decision outcome', () => {
    // From Fix-1 test: seed='two-win', round=1, commit roll=0.739 → FAIL (> COMMIT_P=0.7).
    // Override rounds=1 so this IS the last round → expect decision outcome.
    const s = makeWindowState({ round: 1, rounds: 1 });
    const result = finishStep(s, 'commit');
    expect(result.phase).toBe('finished');
    expect(result.outcome).not.toBeNull();
    expect(result.outcome!.method).toBe('decision');
  });
});
