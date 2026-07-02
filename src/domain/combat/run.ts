import type { StatLine } from './stats';
import type { FightState } from './fightState';
import { startFight } from './fightState';
import { generateOpponent } from './opponent';

export type RunPhase = 'drafting' | 'pre-fight' | 'fighting' | 'run-over';

export interface RunFighter {
  name: string;
  statLine: StatLine;
}

export interface RunState {
  seed: string;
  phase: RunPhase;
  fighter: RunFighter | null;
  fightNumber: number;
  record: { wins: number; losses: number };
  isChampion: boolean;
  defenses: number;
  fight: FightState | null;
}

export const TITLE_FIGHT = 5;

export function startRun(seed: string): RunState {
  return {
    seed,
    phase: 'drafting',
    fighter: null,
    fightNumber: 1,
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
  return { ...run, phase: 'pre-fight', fighter: { name: fighter.name, statLine: fighter.statLine } };
}

export function startNextFight(run: RunState): RunState {
  if (run.phase !== 'pre-fight') {
    throw new Error(`startNextFight requires phase 'pre-fight' (got '${run.phase}')`);
  }
  if (!run.fighter) {
    throw new Error('startNextFight requires a drafted fighter');
  }
  const opponent = generateOpponent(run.seed, run.fightNumber);
  const fight = startFight({
    seed: run.seed,
    fightNumber: run.fightNumber,
    playerStatLine: run.fighter.statLine,
    opponent,
  });
  return { ...run, phase: 'fighting', fight };
}

export function settleFight(run: RunState, fightState: FightState): RunState {
  if (!fightState.outcome) {
    throw new Error('settleFight requires a settled fight (outcome must be non-null)');
  }
  if (fightState.outcome.winner !== 'player') {
    return { ...run, phase: 'run-over', record: { ...run.record, losses: 1 }, fight: fightState };
  }
  const wasChampion = run.isChampion;
  const isChampion = wasChampion || run.fightNumber === TITLE_FIGHT;
  const defenses = wasChampion ? run.defenses + 1 : run.defenses;
  return {
    ...run,
    phase: 'pre-fight',
    record: { ...run.record, wins: run.record.wins + 1 },
    fightNumber: run.fightNumber + 1,
    isChampion,
    defenses,
    fight: fightState,
  };
}
