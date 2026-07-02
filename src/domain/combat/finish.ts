import type { FightState, FinishWindow } from './fightState';
import type { RoundIntent } from './intents';
import type { StatLine } from './stats';
import { isGassed, STAMINA_MAX } from './stamina';
import { createRng } from '../rng';

// ── Tuning constants (adjust in Task 11) ─────────────────────────────────────
export const COMMIT_P = 0.7;
export const MEASURE_P = 0.35;
export const INITIAL_STEPS = 3;
const FINISH_STAMINA_COST = 15;
/** submissionDef below this → vulnerable to grapple reads */
const LOW_SUB_DEF = 55;

// ── ROCKED_HEAD_DMG ───────────────────────────────────────────────────────────
/** Head-damage threshold to be "rocked". Scales directly with chin:
 *  higher chin ⇒ higher threshold ⇒ harder to rock. */
export function ROCKED_HEAD_DMG(chin: number): number {
  return Math.round(chin * 1.0);
}

// ── FinishChoice ──────────────────────────────────────────────────────────────
export type FinishChoice = 'commit' | 'measure' | 'hold';
export const FINISH_CHOICES: readonly FinishChoice[] = ['commit', 'measure', 'hold'] as const;

// ── detectWindow ─────────────────────────────────────────────────────────────
/** Context produced by resolveRound after damage + stamina are settled. */
export interface ResolvedContext {
  playerHeadDamage: number;
  opponentHeadDamage: number;
  playerStamina: number;
  opponentStamina: number;
  playerStatLine: StatLine;
  opponentStatLine: StatLine;
  /** Signed dominance from the exchange (>0 = player won). */
  dominance: number;
  playerIntent: RoundIntent;
  opponentIntent: RoundIntent;
}

/**
 * Returns a FinishWindow if the just-resolved round triggered a finish
 * opportunity, or null if the fight continues normally.
 *
 * Trigger logic (evaluated in order):
 *   1. Damage path: headDamage ≥ ROCKED_HEAD_DMG(chin) → KO window.
 *   2. Read path: clean counter vs pressure, grapple vs low submissionDef,
 *      or gassed opponent → KO or submission window.
 *
 * `side` = the side ABOUT TO FINISH (the one who landed the trigger).
 */
export function detectWindow(ctx: ResolvedContext): FinishWindow | null {
  const {
    playerHeadDamage, opponentHeadDamage,
    playerStamina, opponentStamina,
    playerStatLine, opponentStatLine,
    dominance, playerIntent, opponentIntent,
  } = ctx;

  // ── 1. Damage path (KO) ───────────────────────────────────────────────────
  if (opponentHeadDamage >= ROCKED_HEAD_DMG(opponentStatLine.chin)) {
    return { side: 'player', method: 'KO', stepsLeft: INITIAL_STEPS };
  }
  if (playerHeadDamage >= ROCKED_HEAD_DMG(playerStatLine.chin)) {
    return { side: 'opponent', method: 'KO', stepsLeft: INITIAL_STEPS };
  }

  // ── 2. Read path ──────────────────────────────────────────────────────────
  // Clean counter that beat a pressure
  if (playerIntent.approach === 'counter' && opponentIntent.approach === 'pressure' && dominance > 0) {
    return { side: 'player', method: 'KO', stepsLeft: INITIAL_STEPS };
  }
  if (opponentIntent.approach === 'counter' && playerIntent.approach === 'pressure' && dominance < 0) {
    return { side: 'opponent', method: 'KO', stepsLeft: INITIAL_STEPS };
  }

  // Grapple submission attempt vs low submissionDef
  if (playerIntent.where === 'grapple' && opponentStatLine.submissionDef < LOW_SUB_DEF && dominance > 0) {
    return { side: 'player', method: 'submission', stepsLeft: INITIAL_STEPS };
  }
  if (opponentIntent.where === 'grapple' && playerStatLine.submissionDef < LOW_SUB_DEF && dominance < 0) {
    return { side: 'opponent', method: 'submission', stepsLeft: INITIAL_STEPS };
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
    // SUCCESS → fight finished
    return {
      ...state,
      phase: 'finished',
      window: null,
      outcome: {
        winner: win.side,
        method: win.method,
        round: state.round,
      },
    };
  }

  // FAILURE
  if (choice === 'commit') {
    // Window closes; apply stamina cost to finisher; advance round
    const newRound = state.round + 1;
    const nextPhase = newRound > state.rounds ? 'finished' : 'in-round';
    return {
      ...state,
      phase: nextPhase,
      window: null,
      round: newRound,
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
  }

  // measure / hold: lower probability but preserves a step
  const newStepsLeft = win.stepsLeft - 1;
  if (newStepsLeft <= 0) {
    const newRound = state.round + 1;
    const nextPhase = newRound > state.rounds ? 'finished' : 'in-round';
    return {
      ...state,
      phase: nextPhase,
      window: null,
      round: newRound,
    };
  }

  return {
    ...state,
    window: { ...win, stepsLeft: newStepsLeft },
  };
}
