import type { FightState, FinishWindow } from './fightState';
import type { ExchangeMove, GroundPlan } from './intents';
import { STRIKES } from './strikes';
import type { StatLine } from './stats';
import { isGassed, STAMINA_MAX } from './stamina';
import { createRng } from '../rng';
import { scoreFight } from './judges';

// ── Tuning constants (adjust in Task 11) ─────────────────────────────────────
export const COMMIT_P = 0.7;
export const MEASURE_P = 0.35;
export const INITIAL_STEPS = 3;
const FINISH_STAMINA_COST = 15;
/** submissionDef below this → vulnerable to takedown-to-submission reads */
const LOW_SUB_DEF = 55;

// ── Ground game constants (Task 2 interim; retune in Task 5) ──────────────────
/** Floor on ground-and-pound head damage per step. */
const GP_MIN = 8;
/** Scales the raw striking/takedown advantage into ground-and-pound damage. */
const GP_FACTOR = 0.7;
/** Base tap probability before the submissions-vs-defense read. */
const SUB_BASE = 0.5;
/** Per-point weight on (submissions − submissionDef) for the tap read. */
const SUB_SCALE = 0.01;

// ── ROCKED_HEAD_DMG ───────────────────────────────────────────────────────────
/** Head-damage threshold to be "rocked". Scales directly with chin:
 *  higher chin ⇒ higher threshold ⇒ harder to rock. */
export function ROCKED_HEAD_DMG(chin: number): number {
  // Clamp to a floor of 1: a threshold that rounds to 0 would let 0 head damage
  // "rock" a fighter, making the damage-path finish window impossible to reason
  // about. Load-bearing only if k drops below ~0.5; at the current k it is a guard.
  return Math.max(1, Math.round(chin * 0.56));
}

// ── Shared ground math ────────────────────────────────────────────────────────
/** Ground-and-pound head damage for one step: `attacker` posts up on `defender`.
 *  Used by BOTH the player ground window (groundStep) and the opponent takedown
 *  follow-up (resolveExchange) so the two sides share one formula, not a copy. */
export function groundAndPoundDamage(attacker: StatLine, defender: StatLine): number {
  const raw = (0.5 * attacker.striking + 0.5 * attacker.takedowns) - 0.5 * defender.strikingDef;
  return Math.max(GP_MIN, Math.round(raw * GP_FACTOR));
}

/** Submission tap probability for one step, clamped to [0.05, 0.95]. Shared by
 *  both sides' ground game so the read is identical whoever is finishing. */
export function submissionTapProbability(attacker: StatLine, defender: StatLine): number {
  return Math.max(
    0.05,
    Math.min(0.95, SUB_BASE + (attacker.submissions - defender.submissionDef) * SUB_SCALE),
  );
}

/** submissionDef below LOW_SUB_DEF → the ground AI reads a submission over GnP. */
export function chooseGroundPlan(defenderStatLine: StatLine): GroundPlan {
  return defenderStatLine.submissionDef < LOW_SUB_DEF ? 'submission' : 'ground-and-pound';
}

// ── FinishChoice ──────────────────────────────────────────────────────────────
export type FinishChoice = 'commit' | 'measure' | 'hold';
export const FINISH_CHOICES: readonly FinishChoice[] = ['commit', 'measure', 'hold'] as const;

// ── detectWindow ─────────────────────────────────────────────────────────────
/** Context produced by resolveExchange after damage + stamina are settled. */
export interface ResolvedContext {
  /** Head damage BEFORE this round's exchange was applied. */
  prePlayerHeadDamage: number;
  preOpponentHeadDamage: number;
  playerHeadDamage: number;
  opponentHeadDamage: number;
  playerStamina: number;
  opponentStamina: number;
  playerStatLine: StatLine;
  opponentStatLine: StatLine;
  /** Signed dominance from the exchange (>0 = player won). */
  dominance: number;
  playerIntent: ExchangeMove;
  opponentIntent: ExchangeMove;
}

/**
 * Returns a FinishWindow if the just-resolved round triggered a finish
 * opportunity, or null if the fight continues normally.
 *
 * Trigger logic (evaluated in order):
 *   1. Damage path: headDamage ≥ ROCKED_HEAD_DMG(chin) → KO window.
 *   2. Read path: clean counter vs pressure, or gassed opponent → KO window.
 *
 * `side` = the side ABOUT TO FINISH (the one who landed the trigger).
 */
export function detectWindow(ctx: ResolvedContext): FinishWindow | null {
  const {
    prePlayerHeadDamage, preOpponentHeadDamage,
    playerHeadDamage, opponentHeadDamage,
    playerStamina, opponentStamina,
    playerStatLine, opponentStatLine,
    dominance, playerIntent, opponentIntent,
  } = ctx;

  // ── 1. Damage path (KO) ───────────────────────────────────────────────────
  // A damage-path window opens ONLY for the side that won THIS exchange, and
  // only when THIS round's head damage pushed the loser across the rocked
  // threshold (pre < threshold ≤ post). Stale accumulated damage from a prior
  // round never re-opens a window.
  const oppRocked = ROCKED_HEAD_DMG(opponentStatLine.chin);
  const playerRocked = ROCKED_HEAD_DMG(playerStatLine.chin);
  if (
    dominance > 0 &&
    preOpponentHeadDamage < oppRocked &&
    opponentHeadDamage >= oppRocked
  ) {
    return { side: 'player', method: 'KO', stepsLeft: INITIAL_STEPS };
  }
  if (
    dominance < 0 &&
    prePlayerHeadDamage < playerRocked &&
    playerHeadDamage >= playerRocked
  ) {
    return { side: 'opponent', method: 'KO', stepsLeft: INITIAL_STEPS };
  }

  // ── 2. Read path ──────────────────────────────────────────────────────────
  // Timing read: a fast strike (speed >= 0.7) that beats a high-commit strike
  // (koWeight >= 1.0) opens a KO window for the side that won the exchange.
  const fastBeatsCommit = (fast: ExchangeMove, slow: ExchangeMove): boolean =>
    fast.kind === 'strike' && slow.kind === 'strike' &&
    STRIKES[fast.strike].speed >= 0.7 && STRIKES[slow.strike].koWeight >= 1.0;
  if (fastBeatsCommit(playerIntent, opponentIntent) && dominance > 0) {
    return { side: 'player', method: 'KO', stepsLeft: INITIAL_STEPS };
  }
  if (fastBeatsCommit(opponentIntent, playerIntent) && dominance < 0) {
    return { side: 'opponent', method: 'KO', stepsLeft: INITIAL_STEPS };
  }

  // Gassed opponent
  if (isGassed(opponentStamina) && dominance > 0) {
    return { side: 'player', method: 'KO', stepsLeft: INITIAL_STEPS };
  }
  if (isGassed(playerStamina) && dominance < 0) {
    return { side: 'opponent', method: 'KO', stepsLeft: INITIAL_STEPS };
  }

  return null;
}

// ── finishStep ────────────────────────────────────────────────────────────────
/** Resolve one pressure decision in the finish sequence.
 *  Requires state.phase === 'finish-window'. Throws otherwise. */
export function finishStep(state: FightState, choice: FinishChoice): FightState {
  if (state.phase !== 'finish-window') {
    throw new Error('finishStep requires state.phase === "finish-window"');
  }
  const win = state.window!;
  // Derive a stable step index from steps consumed: 0 on first call, +1 each
  const stepIndex = INITIAL_STEPS - win.stepsLeft;
  const rng = createRng(`${state.seed}#f${state.fightNumber}#r${state.round}#finish${stepIndex}`);
  const roll = rng();

  const p = choice === 'commit' ? COMMIT_P : MEASURE_P;

  if (roll < p) {
    // SUCCESS → fight finished. A finish window is only ever KO/submission.
    const method = win.method;   // narrowed to 'KO' | 'submission' by the type
    return {
      ...state,
      phase: 'finished',
      window: null,
      outcome: {
        winner: win.side,
        method,
        round: state.round,
      },
    };
  }

  // FAILURE
  if (choice === 'commit') {
    // Window closes; apply stamina cost to finisher; advance round
    const newRound = state.round + 1;
    const isOver = newRound > state.rounds;
    const updatedState: FightState = {
      ...state,
      phase: isOver ? 'finished' : 'corner',
      window: null,
      round: isOver ? state.round : newRound,
      exchange: isOver ? state.exchange : 1,
      player: {
        ...state.player,
        stamina: win.side === 'player'
          ? Math.max(0, Math.min(STAMINA_MAX, state.player.stamina - FINISH_STAMINA_COST))
          : state.player.stamina,
      },
      opponent: {
        ...state.opponent,
        stamina: win.side === 'opponent'
          ? Math.max(0, Math.min(STAMINA_MAX, state.opponent.stamina - FINISH_STAMINA_COST))
          : state.opponent.stamina,
      },
    };
    if (isOver) {
      return { ...updatedState, outcome: scoreFight(updatedState) };
    }
    return updatedState;
  }

  // measure / hold: lower probability but preserves a step
  const newStepsLeft = win.stepsLeft - 1;
  if (newStepsLeft <= 0) {
    const newRound = state.round + 1;
    const isOver = newRound > state.rounds;
    if (isOver) {
      const base: FightState = { ...state, phase: 'finished', window: null, round: state.round };
      return { ...base, outcome: scoreFight(base) };
    }
    return {
      ...state,
      phase: 'corner',
      window: null,
      round: newRound,
      exchange: 1,
    };
  }

  return {
    ...state,
    window: { ...win, stepsLeft: newStepsLeft },
  };
}

