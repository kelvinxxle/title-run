import type { StatId, StatLine } from './stats';
import type { Opponent } from './opponent';
import { generateOpponent } from './opponent';
import { createRng } from './rng';

const DURA_BASE = 50;
const CHIN_FACTOR = 0.5;
const IQ_FACTOR = 0.1;
const ROLL_RANGE = 30;
const DMG_FACTOR = 0.6;
const MAX_ROUND_DAMAGE = 32;

const STYLE_FINISH: Record<Opponent['style'], 'KO' | 'submission'> = {
  striker: 'KO',
  brawler: 'KO',
  allrounder: 'KO',
  grappler: 'submission',
  wrestler: 'submission',
};

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
    player: { statLine: { ...playerStatLine }, damage: carryInDamage },
    opponent: { ...opponent, damage: 0 },
    history: [],
    status: 'in-progress',
    outcome: null,
  };
}

function pairAvg(statLine: StatLine, pair: [StatId, StatId]): number {
  return (statLine[pair[0]] + statLine[pair[1]]) / 2;
}

export function resolveRound(state: FightState, intent: Intent): FightState {
  if (state.status !== 'in-progress') {
    throw new Error(`resolveRound: fight is already ${state.status}`);
  }
  const cfg = INTENTS[intent];
  if (!cfg) {
    throw new Error(`resolveRound: unknown intent "${intent}"`);
  }

  const p = state.player.statLine;
  const o = state.opponent.statLine;
  const yourOff = pairAvg(p, cfg.offense);
  const theirDef = pairAvg(o, cfg.defense);
  const iqTilt = (p.fightIQ - o.fightIQ) * IQ_FACTOR;
  const roll = createRng(`${state.seed}#f${state.fightNumber}#r${state.round}`)();
  const rollSwing = (roll - 0.5) * ROLL_RANGE;
  const dominance = Math.round(yourOff - theirDef + iqTilt + rollSwing);
  const dmg = Math.min(MAX_ROUND_DAMAGE, Math.max(0, Math.round(Math.abs(dominance) * DMG_FACTOR)));

  const roundWinner: Side = dominance >= 0 ? 'player' : 'opponent';
  let playerDamage = state.player.damage;
  let opponentDamage = state.opponent.damage;
  if (roundWinner === 'player') {
    opponentDamage += dmg;
  } else {
    playerDamage += dmg;
  }

  const result: RoundResult = { round: state.round, intent, dominance, roundWinner, playerDamage, opponentDamage };
  const history = [...state.history, result];
  const next: FightState = {
    ...state,
    player: { ...state.player, damage: playerDamage },
    opponent: { ...state.opponent, damage: opponentDamage },
    history,
  };

  if (roundWinner === 'player' && cfg.finish !== null && opponentDamage >= durability(o)) {
    return { ...next, status: 'won', outcome: { method: cfg.finish, round: state.round, winner: 'player' } };
  }
  if (roundWinner === 'opponent' && playerDamage >= durability(p)) {
    return { ...next, status: 'lost', outcome: { method: STYLE_FINISH[state.opponent.style], round: state.round, winner: 'opponent' } };
  }
  if (state.round >= state.rounds) {
    const playerRoundsWon = history.filter((r) => r.roundWinner === 'player').length;
    const opponentRoundsWon = history.length - playerRoundsWon;
    const winner: Side = playerRoundsWon >= opponentRoundsWon ? 'player' : 'opponent';
    return { ...next, status: winner === 'player' ? 'won' : 'lost', outcome: { method: 'decision', round: state.rounds, winner } };
  }
  return { ...next, round: state.round + 1 };
}

export function carryOutDamage(state: FightState): number {
  if (state.status !== 'won') {
    throw new Error('carryOutDamage: fight was not won');
  }
  return state.player.damage;
}
