import type { StatLine } from './stats';
import { startFight, carryOutDamage, type FightState } from './fight';

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
  if (!outcome || outcome.winner !== 'player') {
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
