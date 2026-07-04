import { describe, it, expect } from 'vitest';
import {
  startRun,
  applyDraft,
  startNextFight,
  settleFight,
  resolveRound,
  finishStep,
  buildStatLine,
  getFighter,
  type FightState,
  type RunState,
  type RoundIntent,
} from './index';

// A deterministic "always technical head strike" policy — enough to drive a
// fight to a terminal state (finish or decision) without any Math.random.
function drivePlayerIntent(): RoundIntent {
  return { kind: 'strike', target: 'head', tactic: 'pickApart' };
}

function playFightToEnd(initial: FightState): FightState {
  let state = initial;
  let guard = 0;
  while (state.phase !== 'finished') {
    if (guard++ > 200) throw new Error('fight did not terminate');
    if (state.phase === 'in-round') {
      state = resolveRound(state, drivePlayerIntent());
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
