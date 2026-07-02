import { describe, it, expect } from 'vitest';
import { startRun, applyDraft, startNextFight, settleFight, rewardDelta, rerollValue, applyReward, TITLE_FIGHT, type RunState } from './run';
import { durability, resolveRound, startFight } from './fight';
import type { FightState, FightOutcome } from './fight';

const PLAYER = { boxing:82, kicks:92, clinch:80, takedowns:98, submissions:97, topControl:88, cardio:90, chin:88, fightIQ:78 };

function readyRun(over: Partial<RunState> = {}): RunState {
  return { ...applyDraft(startRun('run-42'), { name: 'Kelvin', statLine: PLAYER }), ...over };
}

function settledFight(outcome: FightOutcome, carry: number): FightState {
  return {
    seed: 'run-42', fightNumber: 1, round: 3,
    status: outcome.winner === 'player' ? 'won' : 'lost',
    outcome,
    player: { statLine: PLAYER, damage: carry },
  } as unknown as FightState;
}

describe('startRun', () => {
  it('begins a run in the drafting phase with no fighter', () => {
    const run = startRun('run-42');
    expect(run).toEqual({
      seed: 'run-42',
      phase: 'drafting',
      fighter: null,
      fightNumber: 1,
      carriedDamage: 0,
      record: { wins: 0, losses: 0 },
      isChampion: false,
      defenses: 0,
      fight: null,
    });
  });

  it('is JSON round-trippable', () => {
    const run = startRun('run-42');
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
  });
});

describe('applyDraft', () => {
  it('stores the fighter and advances to pre-fight', () => {
    const run = applyDraft(startRun('run-42'), { name: 'Kelvin', statLine: PLAYER });
    expect(run.phase).toBe('pre-fight');
    expect(run.fighter).toEqual({ name: 'Kelvin', statLine: PLAYER });
    expect(run.fightNumber).toBe(1);
  });

  it('accepts a DraftedFighter shape and ignores extra fields like slots', () => {
    const drafted = { name: 'Kelvin', statLine: PLAYER, slots: {} } as unknown as { name: string; statLine: typeof PLAYER };
    const run = applyDraft(startRun('run-42'), drafted);
    expect(run.fighter).toEqual({ name: 'Kelvin', statLine: PLAYER });
  });

  it('does not mutate the input run', () => {
    const run = startRun('run-42');
    applyDraft(run, { name: 'Kelvin', statLine: PLAYER });
    expect(run.phase).toBe('drafting');
    expect(run.fighter).toBeNull();
  });
});

describe('startNextFight', () => {
  it('starts the ladder fight for the drafted fighter', () => {
    const run = readyRun();
    const next = startNextFight(run);
    expect(next.phase).toBe('fighting');
    expect(next.fight).not.toBeNull();
    expect(next.fight?.fightNumber).toBe(1);
  });

  it('throws when there is no drafted fighter', () => {
    expect(() => startNextFight(startRun('run-42'))).toThrow();
  });
});

describe('settleFight', () => {
  it('records a win and moves to reward (non-title fight)', () => {
    const run = { ...readyRun(), phase: 'fighting' as const };
    const out = settleFight(run, settledFight({ winner: 'player', method: 'decision', round: 3 } as FightOutcome, 0));
    expect(out.phase).toBe('reward');
    expect(out.record).toEqual({ wins: 1, losses: 0 });
    expect(out.isChampion).toBe(false);
    expect(out.defenses).toBe(0);
    expect(out.fight).not.toBeNull();
  });

  it('crowns a champion when winning fight 5 but adds no defense that fight', () => {
    const run = { ...readyRun(), phase: 'fighting' as const, fightNumber: TITLE_FIGHT };
    const out = settleFight(run, settledFight({ winner: 'player', method: 'decision', round: 5 } as FightOutcome, 0));
    expect(out.isChampion).toBe(true);
    expect(out.defenses).toBe(0);
  });

  it('adds a defense when a champion wins fight 6+', () => {
    const run = { ...readyRun(), phase: 'fighting' as const, fightNumber: 6, isChampion: true, defenses: 0 };
    const out = settleFight(run, settledFight({ winner: 'player', method: 'decision', round: 5 } as FightOutcome, 0));
    expect(out.defenses).toBe(1);
  });

  it('ends the run on a loss', () => {
    const run = { ...readyRun(), phase: 'fighting' as const };
    const out = settleFight(run, settledFight({ winner: 'opponent', method: 'KO', round: 2 } as FightOutcome, 0));
    expect(out.phase).toBe('run-over');
    expect(out.record).toEqual({ wins: 0, losses: 1 });
    expect(out.fight).not.toBeNull();
  });

  it('settleFight throws when given an unsettled (in-progress) fight', () => {
    const run = startRun('run-42');
    const inProgress = startFight({
      seed: 'run-42', fightNumber: 1, playerStatLine: PLAYER, carryInDamage: 0,
    });
    expect(inProgress.outcome).toBeNull();
    expect(() => settleFight(run, inProgress)).toThrow(/settled/i);
  });
});

function rewardReadyRun(over: Partial<RunState> = {}): RunState {
  return {
    ...applyDraft(startRun('run-42'), { name: 'Kelvin', statLine: PLAYER }),
    phase: 'reward',
    ...over,
  };
}

describe('rerollValue', () => {
  it('draws a fresh fighter from the reward stream and returns the chosen slot', () => {
    expect(rerollValue('run-42', 1, 'boxing')).toBe(60);
    expect(rerollValue('run-42', 1, 'fightIQ')).toBe(86);
  });
});

describe('rewardDelta', () => {
  it('previews a stat bump (+8, clamped at 99)', () => {
    expect(rewardDelta(rewardReadyRun(), { type: 'bump', stat: 'boxing' }))
      .toEqual({ reward: { type: 'bump', stat: 'boxing' }, stat: 'boxing', from: 82, to: 90 });
    expect(rewardDelta(rewardReadyRun(), { type: 'bump', stat: 'submissions' }).to).toBe(99);
  });

  it('previews a gamble re-roll (may go down)', () => {
    expect(rewardDelta(rewardReadyRun(), { type: 'reroll', stat: 'boxing' }))
      .toEqual({ reward: { type: 'reroll', stat: 'boxing' }, stat: 'boxing', from: 82, to: 60 });
  });

  it('previews recover as healing half max durability', () => {
    expect(rewardDelta(rewardReadyRun({ carriedDamage: 40 }), { type: 'recover' }))
      .toEqual({ reward: { type: 'recover' }, stat: null, from: 40, to: 0 });
    expect(rewardDelta(rewardReadyRun({ carriedDamage: 80 }), { type: 'recover' }).to).toBe(33);
  });
});

describe('applyReward', () => {
  it('applies a bump, advances the fight number and returns to pre-fight', () => {
    const out = applyReward(rewardReadyRun(), { type: 'bump', stat: 'boxing' });
    expect(out.fighter?.statLine.boxing).toBe(90);
    expect(out.fightNumber).toBe(2);
    expect(out.phase).toBe('pre-fight');
    expect(out.fight).toBeNull();
  });

  it('applies a re-roll (writes the drawn value)', () => {
    const out = applyReward(rewardReadyRun(), { type: 'reroll', stat: 'boxing' });
    expect(out.fighter?.statLine.boxing).toBe(60);
  });

  it('applies recover to carried damage only', () => {
    const out = applyReward(rewardReadyRun({ carriedDamage: 80 }), { type: 'recover' });
    expect(out.carriedDamage).toBe(33);
    expect(out.fighter?.statLine).toEqual(PLAYER);
  });

  it('bumping Chin raises max durability (emergent, via the engine)', () => {
    const before = rewardReadyRun();
    const after = applyReward(before, { type: 'bump', stat: 'chin' });
    // chin 88 -> 96 => durability round(50+96*0.5)=98 > round(50+88*0.5)=94
    expect(durability(after.fighter!.statLine)).toBeGreaterThan(durability(before.fighter!.statLine));
  });

  it('does not mutate the input run', () => {
    const run = rewardReadyRun();
    applyReward(run, { type: 'bump', stat: 'boxing' });
    expect(run.fighter?.statLine.boxing).toBe(82);
    expect(run.fightNumber).toBe(1);
  });
});

describe('full deterministic run', () => {
  function playFight(run: RunState): RunState {
    let started = startNextFight(run);
    let fs = started.fight!;
    while (fs.status === 'in-progress') {
      fs = resolveRound(fs, 'strike');
    }
    return settleFight(started, fs);
  }

  it('plays a full deterministic run: champion at fight 5, loss at fight 6', () => {
    let run = applyDraft(startRun('run-42'), { name: 'Kelvin', statLine: PLAYER });

    // fights 1..5 — all wins, reward = recover (no-op at 0 damage)
    for (let i = 0; i < 5; i++) {
      run = playFight(run);
      expect(run.phase).toBe('reward');
      run = applyReward(run, { type: 'recover' });
      expect(run.phase).toBe('pre-fight');
    }
    expect(run.isChampion).toBe(true);
    expect(run.defenses).toBe(0);
    expect(run.record).toEqual({ wins: 5, losses: 0 });
    expect(run.fightNumber).toBe(6);

    // fight 6 — loss ends the run
    run = playFight(run);
    expect(run.phase).toBe('run-over');
    expect(run.record).toEqual({ wins: 5, losses: 1 });
    expect(run.fight?.outcome?.winner).toBe('opponent');
  });
});
