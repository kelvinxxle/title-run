import type { StatLine } from './stats';
import { PHASE_OFFENSE } from './stats';
import type { GamePlan, ExchangeMove } from './intents';
import { STRIKES, type StrikeId } from './strikes';
import type { RoundReport } from './report';
import { startingStamina } from './stamina';
import { isGassed } from './stamina';
import { createRng } from '../rng';

// ── Core types ───────────────────────────────────────────────────────────────

export interface Fighter2 {
  statLine: StatLine;
  headDamage: number;
  bodyDamage: number;
  stamina: number;
  roundScore: number;
}

export type FightPhase = 'in-round' | 'corner' | 'finish-window' | 'ground-window' | 'finished';

export interface FinishWindow {
  side: 'player' | 'opponent';
  method: 'KO' | 'submission' | 'ground';
  stepsLeft: number;
}

export interface FightOutcome {
  winner: 'player' | 'opponent';
  method: 'KO' | 'submission' | 'decision';
  round: number;
}

export interface RoundLogEntry {
  round: number;
  exchange: number;
  playerIntent: ExchangeMove;
  opponentIntent: ExchangeMove;
  winner: 'player' | 'opponent' | 'draw';
  dominance: number;
}

export type OpponentLike = {
  id: string;
  name: string;
  archetype: string;
  statLine: StatLine;
};

export interface FightState {
  seed: string;
  fightNumber: number;
  rounds: number;
  round: number;
  /** 1-based beat index within the current round (1..EXCHANGES_PER_ROUND). Reset to 1 on entering a corner. */
  exchange: number;
  phase: FightPhase;
  player: Fighter2;
  opponent: Fighter2 & { name: string; archetype: string };
  window: FinishWindow | null;
  outcome: FightOutcome | null;
  log: RoundLogEntry[];
  gamePlan: GamePlan | null;
  lastReport: RoundReport | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function roundsForFight(fightNumber: number): number {
  return fightNumber >= 5 ? 5 : 3;
}

function makeFighter(statLine: StatLine): Fighter2 {
  return {
    statLine,
    headDamage: 0,
    bodyDamage: 0,
    stamina: startingStamina(statLine),
    roundScore: 0,
  };
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function startFight(args: {
  seed: string;
  fightNumber: number;
  playerStatLine: StatLine;
  opponent: OpponentLike;
}): FightState {
  const { seed, fightNumber, playerStatLine, opponent } = args;
  return {
    seed,
    fightNumber,
    rounds: roundsForFight(fightNumber),
    round: 1,
    exchange: 1,
    phase: 'in-round',
    player: makeFighter(playerStatLine),
    opponent: { ...makeFighter(opponent.statLine), name: opponent.name, archetype: opponent.archetype },
    window: null,
    outcome: null,
    log: [],
    gamePlan: null,
    lastReport: null,
  };
}

export function chooseGamePlan(state: FightState, plan: GamePlan): FightState {
  if (state.phase !== 'corner') {
    throw new Error(`chooseGamePlan requires state.phase === "corner" (got "${state.phase}")`);
  }
  return { ...state, gamePlan: plan, phase: 'in-round', exchange: 1 };
}

// ── Feature A tuning constants (tune in T4) ───────────────────────────────────
/** Number of recent log entries to examine for player pressure. */
const ADAPTIVE_N = 3;
/** Baseline counter-chance addition (fires even with 0 predictability). */
const ADAPTIVE_BASE = 0.05;
/** Scales (IQ − IQ_MID) × predictability into extra counter probability. */
const ADAPTIVE_IQ_FACTOR = 0.008;
/** Opponents at or below this IQ gain no read bonus. */
const ADAPTIVE_IQ_MID = 60;
/** Hard cap on total counter-chance from the adaptive gate. */
const ADAPTIVE_CAP = 0.65;

/** A strike at or above this koWeight is a head-hunting power strike (powerPunch/elbow). */
const HEAD_HUNT_KOWEIGHT = 1.0;

/**
 * Fraction of the last `n` log entries where the player threw a head-hunting power
 * strike (`kind === 'strike'` and `STRIKES[strike].koWeight >= HEAD_HUNT_KOWEIGHT`).
 * Returns 0 whenever the log has fewer than `n` entries (not enough data to read).
 */
export function computePredictability(log: RoundLogEntry[], n: number): number {
  if (log.length < n) return 0;
  const recent = log.slice(-n);
  const headHunts = recent.filter(
    (e) => e.playerIntent.kind === 'strike' && STRIKES[e.playerIntent.strike].koWeight >= HEAD_HUNT_KOWEIGHT,
  ).length;
  return headHunts / recent.length;
}

/**
 * Adaptive counter probability for an opponent with the given fightIQ reading
 * the given player predictability score.
 */
export function adaptiveCounterChance(fightIQ: number, predictability: number): number {
  const readBonus = ADAPTIVE_IQ_FACTOR * Math.max(0, fightIQ - ADAPTIVE_IQ_MID) * predictability;
  return Math.max(0, Math.min(ADAPTIVE_CAP, ADAPTIVE_BASE + readBonus));
}

// ── Opponent AI ───────────────────────────────────────────────────────────────

export function opponentMove(state: FightState): ExchangeMove {
  const rng = createRng(`${state.seed}#f${state.fightNumber}#ai${state.round}#x${state.exchange}`);

  // Draw both RNG values upfront for uniform consumption regardless of branch.
  const roll = rng();
  const pick = rng();

  // Choose kind by the opponent's better edge over the player's matching defense.
  const strikeEdge = state.opponent.statLine[PHASE_OFFENSE.strike] - state.player.statLine.strikingDef;
  const wrestleEdge = state.opponent.statLine[PHASE_OFFENSE.wrestle] - state.player.statLine.takedownDef;
  if (wrestleEdge > strikeEdge) return { kind: 'takedown' };

  // Gassed player: dig the body/legs to compound the gas.
  if (isGassed(state.player.stamina)) return { kind: 'strike', strike: 'bodyKick' };

  // Adaptive read (M12): punish predictable head-hunting with a fast counter jab.
  // opponentMove is called BEFORE this beat's log entry is pushed, so state.log
  // contains only past beats — fair-play preserved.
  const predictability = computePredictability(state.log, ADAPTIVE_N);
  const counterChance = adaptiveCounterChance(state.opponent.statLine.fightIQ, predictability);
  if (roll < counterChance) return { kind: 'strike', strike: 'jab' };

  // Aggression bias by fightNumber: later fights swing more power.
  const aggression = Math.min(1, (state.fightNumber - 1) / 4);
  if (roll < aggression * 0.5) return { kind: 'strike', strike: 'powerPunch' };

  const MIX: readonly StrikeId[] = ['jab', 'elbow', 'bodyKick', 'legKick'];
  return { kind: 'strike', strike: MIX[Math.floor(pick * MIX.length)] };
}
