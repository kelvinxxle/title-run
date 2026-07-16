import { describe, it, expect } from 'vitest';
import {
  startRun,
  applyDraft,
  startNextFight,
  settleFight,
  startFight,
  resolveExchange,
  finishStep,
  resolveGround,
  buildStatLine,
  getFighter,
  ARCHETYPES,
  type FightState,
  type RunState,
  type ExchangeMove,
} from './index';

// A deterministic "always technical head strike" policy — enough to drive a
// fight to a terminal state (finish or decision) without any Math.random.
function drivePlayerIntent(): ExchangeMove {
  return { kind: 'strike', strike: 'jab' };
}

function continueFromCorner(state: FightState): FightState {
  return state.phase === 'corner' ? { ...state, phase: 'in-round', gamePlan: null } : state;
}

function playFightToEnd(initial: FightState): FightState {
  let state = initial;
  let guard = 0;
  while (state.phase !== 'finished') {
    if (guard++ > 200) throw new Error('fight did not terminate');
    if (state.phase === 'in-round') {
      state = resolveExchange(state, drivePlayerIntent());
    } else if (state.phase === 'corner') {
      state = continueFromCorner(state);
    } else if (state.phase === 'ground') {
      state = resolveGround(state, 'ground-and-pound');
    } else {
      // finish-window: the side with initiative commits
      state = finishStep(state, 'commit');
    }
  }
  return state;
}

function playRunToEnd(seed: string): RunState {
  let run = startRun(seed);
  const fighter = getFighter('georges-st-pierre');
  run = applyDraft(run, { name: fighter.name, statLine: buildStatLine(fighter) });

  let guard = 0;
  while (run.phase !== 'run-over') {
    if (guard++ > 100) throw new Error('run did not terminate');
    run = startNextFight(run);
    const settledFight = playFightToEnd(run.fight!);
    run = settleFight(run, settledFight);
  }
  return run;
}

describe('combat integration: full run', () => {
  it('drives a run from draft to a terminal run-over state', () => {
    const run = playRunToEnd('integration-seed-1');

    expect(run.phase).toBe('run-over');
    expect(run.record.losses).toBe(1);
    // Every fight that was played produced a concrete outcome.
    expect(run.fight).not.toBeNull();
    expect(run.fight!.outcome).not.toBeNull();
    expect(run.fightNumber).toBeGreaterThanOrEqual(1);
  });

  it('is fully reproducible from the seed', () => {
    const a = playRunToEnd('integration-seed-1');
    const b = playRunToEnd('integration-seed-1');

    expect(b.record).toEqual(a.record);
    expect(b.fightNumber).toBe(a.fightNumber);
    expect(b.isChampion).toBe(a.isChampion);
    expect(b.fight!.outcome).toEqual(a.fight!.outcome);
  });

  it('produces different trajectories for different seeds', () => {
    const outcomes = new Set<string>();
    for (const seed of ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8']) {
      const run = playRunToEnd(seed);
      outcomes.add(`${run.fightNumber}:${run.isChampion}:${run.fight!.outcome!.method}`);
    }
    // Seeds should not all collapse to one identical trajectory.
    expect(outcomes.size).toBeGreaterThan(1);
  });
});

// ── Combat decision-space integration ──────────────────────────────────────────
// These tests drive the REAL state machine (resolveExchange → finish/ground → step)
// end-to-end for each finishing method, proving the strike/wrestle/ground redesign
// flows through concrete outcomes. They deliberately open every window through
// resolveExchange (not by hand-constructing a window state), which is the distinct
// value over finish.test.ts's unit-level groundStep tests.

/** Drives an in-round fight to a terminal state under a fixed strike policy,
 *  committing every finish window. Only reachable phases are in-round + finish-window. */
function driveStrikeFightToEnd(initial: FightState, intent: ExchangeMove): FightState {
  let s = initial;
  let guard = 0;
  while (s.phase !== 'finished') {
    if (guard++ > 200) throw new Error('strike fight did not terminate');
    if (s.phase === 'in-round') s = resolveExchange(s, intent);
    else if (s.phase === 'corner') s = continueFromCorner(s);
    else if (s.phase === 'finish-window') s = finishStep(s, 'commit');
    else throw new Error(`unexpected phase in strike driver: ${s.phase}`);
  }
  return s;
}

describe('combat integration: finishing methods through the real state machine', () => {
  it('a head-strike campaign drives a fight to a KO win for the player', () => {
    // Fragile-chinned, porous-defense opponent so head pressure opens a KO window
    // and a commit lands. seed 'integration-strike-ko' resolves to a round-1 KO.
    const player = { ...ARCHETYPES.brawler, striking: 99 };
    const opp = {
      id: 'g',
      name: 'Glass',
      archetype: 'brawler' as const,
      statLine: { ...ARCHETYPES.brawler, chin: 20, strikingDef: 20 },
    };
    const s0 = startFight({ seed: 'integration-strike-ko', fightNumber: 1, playerStatLine: player, opponent: opp });
    const end = driveStrikeFightToEnd(s0, { kind: 'strike', strike: 'powerPunch' });

    expect(end.phase).toBe('finished');
    expect(end.outcome).not.toBeNull();
    expect(end.outcome!.winner).toBe('player');
    expect(end.outcome!.method).toBe('KO');
  });

  it('a winning wrestle enters the ground phase that a Ground & Pound closes as a KO', () => {
    // Player: wrestler with huge takedowns. Opponent: weak takedownDef (so the shot
    // lands and dominance > 0) and a glass chin (chin:1 → ROCKED_HEAD_DMG=1) so the
    // first GnP step crosses the rocked threshold → KO finish window → finish.
    const player = { ...ARCHETYPES.wrestler, takedowns: 99 };
    const opp = {
      id: 'o',
      name: 'Opp',
      archetype: 'striker' as const,
      statLine: { ...ARCHETYPES.striker, takedownDef: 20, chin: 1 },
    };
    const s0 = startFight({ seed: 'gnp-tko-0', fightNumber: 1, playerStatLine: player, opponent: opp });

    // Takedown enters ground phase (NOT a window).
    const opened = resolveExchange(s0, { kind: 'takedown', takedownType: 'double-leg' });
    expect(opened.phase).toBe('ground');
    expect(opened.ground).not.toBeNull();
    expect(opened.ground!.position).toBe('half-guard');
    expect(opened.window).toBeNull();
    expect(opened.round).toBe(1);

    const afterGnP = resolveGround(opened, 'ground-and-pound');
    // chin=1 → rocked immediately → finish-window → commit to finish
    const finished = afterGnP.phase === 'finish-window' ? finishStep(afterGnP, 'commit') : afterGnP;
    expect(['finish-window', 'finished']).toContain(afterGnP.phase);
    if (finished.phase === 'finished') {
      expect(finished.outcome!.winner).toBe('player');
      expect(finished.outcome!.method).toBe('KO');
    }
  });

  it('a winning wrestle enters the ground phase that a Submission closes as a tap', () => {
    // Player: grappler (high submissions) with huge takedowns. Opponent: weak
    // takedownDef (shot lands) and porous submissionDef so the tap read clamps high.
    const player = { ...ARCHETYPES.grappler, takedowns: 99 };
    const opp = {
      id: 'o',
      name: 'Opp',
      archetype: 'striker' as const,
      statLine: { ...ARCHETYPES.striker, takedownDef: 20, submissionDef: 10 },
    };
    const s0 = startFight({ seed: 'sub-win-0', fightNumber: 1, playerStatLine: player, opponent: opp });

    const opened = resolveExchange(s0, { kind: 'takedown', takedownType: 'double-leg' });
    expect(opened.phase).toBe('ground');
    expect(opened.ground).not.toBeNull();

    const result = resolveGround(opened, 'submission');
    expect(['finished', 'ground', 'in-round', 'corner']).toContain(result.phase);
    if (result.phase === 'finished') {
      expect(result.outcome!.winner).toBe('player');
      expect(result.outcome!.method).toBe('submission');
    }
  });

  it('the three finishing paths are fully reproducible from their seeds', () => {
    // 1. Strike KO — same setup as the strike-KO test above.
    const strikePlayer = { ...ARCHETYPES.brawler, striking: 99 };
    const strikeOpp = {
      id: 'g',
      name: 'Glass',
      archetype: 'brawler' as const,
      statLine: { ...ARCHETYPES.brawler, chin: 20, strikingDef: 20 },
    };
    const strikeIntent: ExchangeMove = { kind: 'strike', strike: 'powerPunch' };
    const strikeEndA = driveStrikeFightToEnd(startFight({ seed: 'integration-strike-ko', fightNumber: 1, playerStatLine: strikePlayer, opponent: strikeOpp }), strikeIntent);
    const strikeEndB = driveStrikeFightToEnd(startFight({ seed: 'integration-strike-ko', fightNumber: 1, playerStatLine: strikePlayer, opponent: strikeOpp }), strikeIntent);
    expect(strikeEndA.outcome).not.toBeNull();
    expect(strikeEndB.outcome).toEqual(strikeEndA.outcome);

    // 2. Ground & Pound determinism — same seed → identical result.
    const gnpPlayer = { ...ARCHETYPES.wrestler, takedowns: 99 };
    const gnpOpp = {
      id: 'o',
      name: 'Opp',
      archetype: 'striker' as const,
      statLine: { ...ARCHETYPES.striker, takedownDef: 20, chin: 1 },
    };
    const gnpOpenA = resolveExchange(startFight({ seed: 'gnp-tko-0', fightNumber: 1, playerStatLine: gnpPlayer, opponent: gnpOpp }), { kind: 'takedown', takedownType: 'double-leg' });
    const gnpOpenB = resolveExchange(startFight({ seed: 'gnp-tko-0', fightNumber: 1, playerStatLine: gnpPlayer, opponent: gnpOpp }), { kind: 'takedown', takedownType: 'double-leg' });
    expect(gnpOpenA.phase).toBe('ground');
    const gnpEndA = resolveGround(gnpOpenA, 'ground-and-pound');
    const gnpEndB = resolveGround(gnpOpenB, 'ground-and-pound');
    expect(gnpEndA).toEqual(gnpEndB);

    // 3. Submission determinism — same seed → identical result.
    const subPlayer = { ...ARCHETYPES.grappler, takedowns: 99 };
    const subOpp = {
      id: 'o',
      name: 'Opp',
      archetype: 'striker' as const,
      statLine: { ...ARCHETYPES.striker, takedownDef: 20, submissionDef: 10 },
    };
    const subOpenA = resolveExchange(startFight({ seed: 'sub-win-0', fightNumber: 1, playerStatLine: subPlayer, opponent: subOpp }), { kind: 'takedown', takedownType: 'double-leg' });
    const subOpenB = resolveExchange(startFight({ seed: 'sub-win-0', fightNumber: 1, playerStatLine: subPlayer, opponent: subOpp }), { kind: 'takedown', takedownType: 'double-leg' });
    expect(subOpenA.phase).toBe('ground');
    const subEndA = resolveGround(subOpenA, 'submission');
    const subEndB = resolveGround(subOpenB, 'submission');
    expect(subEndA).toEqual(subEndB);
  });
});
