import type { StatLine } from './stats';
import { clampStat, type StatId } from './stats';
import { startFight, carryOutDamage, durability, type FightState } from './fight';
import { createRng } from './rng';
import { rollFighter, buildStatLine } from './roster';

export type RunPhase = 'drafting' | 'pre-fight' | 'fighting' | 'reward' | 'run-over';

export interface RunFighter {
  name: string;
  statLine: StatLine;
}

export interface RunState {
  seed: string;
  phase: RunPhase;
  fighter: RunFighter | null;
  fightNumber: number;
  carriedDamage: number;
  record: { wins: number; losses: number };
  isChampion: boolean;
  defenses: number;
  fight: FightState | null;
}

export const TITLE_FIGHT = 5;
export const BUMP_AMOUNT = 8;
export const RECOVER_FRACTION = 0.5;

export function startRun(seed: string): RunState {
  return {
    seed,
    phase: 'drafting',
    fighter: null,
    fightNumber: 1,
    carriedDamage: 0,
    record: { wins: 0, losses: 0 },
    isChampion: false,
    defenses: 0,
    fight: null,
  };
}

export function applyDraft(
  run: RunState,
  fighter: { name: string; statLine: StatLine },
): RunState {
  return {
    ...run,
    phase: 'pre-fight',
    fighter: { name: fighter.name, statLine: fighter.statLine },
  };
}

export function startNextFight(run: RunState): RunState {
  if (!run.fighter) {
    throw new Error('startNextFight requires a drafted fighter');
  }
  const fight = startFight({
    seed: run.seed,
    fightNumber: run.fightNumber,
    playerStatLine: run.fighter.statLine,
    carryInDamage: run.carriedDamage,
  });
  return { ...run, phase: 'fighting', fight };
}

export function settleFight(run: RunState, fightState: FightState): RunState {
  const outcome = fightState.outcome;
  if (!outcome) {
    throw new Error('settleFight requires a settled fight');
  }
  if (outcome.winner !== 'player') {
    return {
      ...run,
      phase: 'run-over',
      record: { ...run.record, losses: 1 },
      fight: fightState,
    };
  }
  const wasChampion = run.isChampion;
  return {
    ...run,
    phase: 'reward',
    record: { ...run.record, wins: run.record.wins + 1 },
    isChampion: wasChampion || run.fightNumber === TITLE_FIGHT,
    defenses: wasChampion ? run.defenses + 1 : run.defenses,
    carriedDamage: carryOutDamage(fightState),
    fight: fightState,
  };
}

export type Reward =
  | { type: 'bump'; stat: StatId }
  | { type: 'reroll'; stat: StatId }
  | { type: 'recover' };

export interface RewardDelta {
  reward: Reward;
  stat: StatId | null;
  from: number;
  to: number;
}

export function rerollValue(seed: string, fightNumber: number, stat: StatId): number {
  const rng = createRng(`${seed}#reward${fightNumber}`);
  const fighter = rollFighter(rng, []);
  return buildStatLine(fighter)[stat];
}

export function rewardDelta(run: RunState, reward: Reward): RewardDelta {
  if (!run.fighter) {
    throw new Error('rewardDelta requires a drafted fighter');
  }
  const statLine = run.fighter.statLine;
  if (reward.type === 'bump') {
    const from = statLine[reward.stat];
    return { reward, stat: reward.stat, from, to: clampStat(from + BUMP_AMOUNT) };
  }
  if (reward.type === 'reroll') {
    const from = statLine[reward.stat];
    return { reward, stat: reward.stat, from, to: rerollValue(run.seed, run.fightNumber, reward.stat) };
  }
  const from = run.carriedDamage;
  const heal = Math.round(durability(statLine) * RECOVER_FRACTION);
  return { reward, stat: null, from, to: Math.max(0, from - heal) };
}

export function applyReward(run: RunState, reward: Reward): RunState {
  if (!run.fighter) {
    throw new Error('applyReward requires a drafted fighter');
  }
  const delta = rewardDelta(run, reward);
  let fighter = run.fighter;
  let carriedDamage = run.carriedDamage;
  if (delta.stat !== null) {
    fighter = { ...fighter, statLine: { ...fighter.statLine, [delta.stat]: delta.to } };
  } else {
    carriedDamage = delta.to;
  }
  return {
    ...run,
    fighter,
    carriedDamage,
    fightNumber: run.fightNumber + 1,
    phase: 'pre-fight',
    fight: null,
  };
}
