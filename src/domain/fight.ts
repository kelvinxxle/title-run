import type { StatId, StatLine } from './stats';
import type { Opponent } from './opponent';
import { generateOpponent } from './opponent';

const DURA_BASE = 50;
const CHIN_FACTOR = 0.5;

export type Intent = 'strike' | 'clinch' | 'takedown' | 'submit' | 'outpoint';
export type FinishMethod = 'KO' | 'submission' | 'decision';
export type Side = 'player' | 'opponent';

interface IntentConfig {
  offense: [StatId, StatId];
  defense: [StatId, StatId];
  finish: 'KO' | 'submission' | null;
}

export const INTENTS: Record<Intent, IntentConfig> = {
  strike: { offense: ['boxing', 'kicks'], defense: ['chin', 'fightIQ'], finish: 'KO' },
  clinch: { offense: ['clinch', 'cardio'], defense: ['clinch', 'chin'], finish: 'KO' },
  takedown: { offense: ['takedowns', 'topControl'], defense: ['takedowns', 'fightIQ'], finish: null },
  submit: { offense: ['submissions', 'topControl'], defense: ['submissions', 'chin'], finish: 'submission' },
  outpoint: { offense: ['fightIQ', 'cardio'], defense: ['fightIQ', 'cardio'], finish: null },
};

export interface RoundResult {
  round: number;
  intent: Intent;
  dominance: number;
  roundWinner: Side;
  playerDamage: number;
  opponentDamage: number;
}

export interface FightOutcome { method: FinishMethod; round: number; winner: Side; }
export type FightStatus = 'in-progress' | 'won' | 'lost';

export interface FightState {
  seed: string;
  fightNumber: number;
  rounds: number;
  round: number;
  player: { statLine: StatLine; damage: number };
  opponent: Opponent & { damage: number };
  history: RoundResult[];
  status: FightStatus;
  outcome: FightOutcome | null;
}

export interface StartFightArgs {
  seed: string;
  fightNumber: number;
  playerStatLine: StatLine;
  carryInDamage?: number;
}

export function roundsForFight(fightNumber: number): number {
  return fightNumber <= 4 ? 3 : 5;
}

export function durability(statLine: StatLine): number {
  return Math.round(DURA_BASE + statLine.chin * CHIN_FACTOR);
}

export function startFight({ seed, fightNumber, playerStatLine, carryInDamage = 0 }: StartFightArgs): FightState {
  const opponent = generateOpponent(seed, fightNumber);
  return {
    seed,
    fightNumber,
    rounds: roundsForFight(fightNumber),
    round: 1,
    player: { statLine: playerStatLine, damage: carryInDamage },
    opponent: { ...opponent, damage: 0 },
    history: [],
    status: 'in-progress',
    outcome: null,
  };
}
