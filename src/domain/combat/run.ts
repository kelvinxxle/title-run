import type { StatLine, StatId } from './stats';
import type { FightState } from './fightState';
import { startFight } from './fightState';
import { generateOpponent } from './opponent';
import type { SlotFill } from './draft';
import { resolveSignature } from './signatures';

export type RunPhase = 'drafting' | 'pre-fight' | 'fighting' | 'run-over';

export interface RunFighter {
  name: string;
  statLine: StatLine;
  signatureId: string;
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
  fighter: { name: string; statLine: StatLine; slots: Record<StatId, SlotFill> },
): RunState {
  if (run.phase !== 'drafting') {
    throw new Error(`applyDraft requires phase 'drafting' (got '${run.phase}')`);
  }
  const signatureId = resolveSignature(fighter.slots.striking.sourceFighterId).id;
  return {
    ...run,
    phase: 'pre-fight',
    fighter: { name: fighter.name, statLine: fighter.statLine, signatureId },
  };
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
    signatureId: run.fighter.signatureId,
    opponent,
  });
  return { ...run, phase: 'fighting', fight };
}

export function settleFight(run: RunState, fightState: FightState): RunState {
  if (run.phase !== 'fighting') {
    throw new Error(`settleFight requires phase 'fighting' (got '${run.phase}')`);
  }
  if (!run.fight) {
    throw new Error('settleFight requires an active fight');
  }
  if (fightState.seed !== run.seed || fightState.fightNumber !== run.fightNumber) {
    throw new Error('settleFight requires the fightState to match the active fight (seed + fightNumber)');
  }
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
