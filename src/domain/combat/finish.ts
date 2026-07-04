import type { FightState, FinishWindow } from './fightState';
import type { RoundIntent, GroundPlan } from './intents';
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
/** Stamina cost paid by the finisher on a failed submission attempt. */
const GROUND_STAMINA_COST = 12;

// ── ROCKED_HEAD_DMG ───────────────────────────────────────────────────────────
/** Head-damage threshold to be "rocked". Scales directly with chin:
 *  higher chin ⇒ higher threshold ⇒ harder to rock. */
export function ROCKED_HEAD_DMG(chin: number): number {
  return Math.round(chin * 0.56);
}

// ── Shared ground math ────────────────────────────────────────────────────────
/** Ground-and-pound head damage for one step: `attacker` posts up on `defender`.
 *  Used by BOTH the player ground window (groundStep) and the opponent takedown
 *  follow-up (resolveRound) so the two sides share one formula, not a copy. */
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
/** Context produced by resolveRound after damage + stamina are settled. */
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
  playerIntent: RoundIntent;
  opponentIntent: RoundIntent;
}

/**
 * Returns a FinishWindow if the just-resolved round triggered a finish
 * opportunity, or null if the fight continues normally.
 *
 * Trigger logic (evaluated in order):
 *   1. Damage path: headDamage ≥ ROCKED_HEAD_DMG(chin) → KO window.
 *   2. Read path: clean counter vs pressure, takedown vs low submissionDef,
 *      or gassed opponent → KO or submission window.
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
  // Clean counter that beat a pressure
  if (
    playerIntent.kind === 'strike' && playerIntent.tactic === 'counter' &&
    opponentIntent.kind === 'strike' && opponentIntent.tactic === 'pressure' && dominance > 0
  ) {
    return { side: 'player', method: 'KO', stepsLeft: INITIAL_STEPS };
  }
  if (
    opponentIntent.kind === 'strike' && opponentIntent.tactic === 'counter' &&
    playerIntent.kind === 'strike' && playerIntent.tactic === 'pressure' && dominance < 0
  ) {
    return { side: 'opponent', method: 'KO', stepsLeft: INITIAL_STEPS };
  }

  // Takedown (wrestle) that exposes a low submission defense
  if (playerIntent.kind === 'wrestle' && opponentStatLine.submissionDef < LOW_SUB_DEF && dominance > 0) {
    return { side: 'player', method: 'submission', stepsLeft: INITIAL_STEPS };
  }
  if (opponentIntent.kind === 'wrestle' && playerStatLine.submissionDef < LOW_SUB_DEF && dominance < 0) {
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
    // SUCCESS → fight finished. A finish window is only ever KO/submission;
    // 'ground' windows resolve through groundStep, never here.
    const method = win.method === 'ground' ? 'KO' : win.method;
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
      phase: isOver ? 'finished' : 'in-round',
      window: null,
      round: isOver ? state.round : newRound,
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
      phase: 'in-round',
      window: null,
      round: newRound,
    };
  }

  return {
    ...state,
    window: { ...win, stepsLeft: newStepsLeft },
  };
}

// ── groundStep (Task 2) ─────────────────────────────────────────────────────
/** Resolve one decision in a player ground window (Ground & Pound or Submission).
 *  Requires state.phase === 'ground-window'. Throws otherwise. Mirrors finishStep's
 *  terminal/advance pattern (TKO/tap → finished; otherwise close window + advance,
 *  handing off to scoreFight on the last round). */
export function groundStep(state: FightState, plan: GroundPlan): FightState {
  if (state.phase !== 'ground-window') {
    throw new Error('groundStep requires state.phase === "ground-window"');
  }
  const win = state.window!;
  const stepIndex = INITIAL_STEPS - win.stepsLeft;
  const rng = createRng(`${state.seed}#f${state.fightNumber}#r${state.round}#ground${stepIndex}`);

  const finisher = win.side; // Task 2: always 'player', but keep it side-driven.
  const attacker = finisher === 'player' ? state.player : state.opponent;
  const defender = finisher === 'player' ? state.opponent : state.player;

  const newRound = state.round + 1;
  const isOver = newRound > state.rounds;

  if (plan === 'ground-and-pound') {
    const gpDmg = groundAndPoundDamage(attacker.statLine, defender.statLine);
    const preHead = defender.headDamage;
    const postHead = preHead + gpDmg;
    const rocked = ROCKED_HEAD_DMG(defender.statLine.chin);

    // Apply head damage to the defender, preserving each fighter's concrete type.
    const withDamage: FightState = finisher === 'player'
      ? { ...state, opponent: { ...state.opponent, headDamage: postHead } }
      : { ...state, player: { ...state.player, headDamage: postHead } };

    if (preHead < rocked && postHead >= rocked) {
      // TKO
      return {
        ...withDamage,
        phase: 'finished',
        window: null,
        outcome: { winner: finisher, method: 'KO', round: state.round },
      };
    }

    // No finish: close window, advance round (or hand off to a decision if last round).
    const advanced: FightState = {
      ...withDamage,
      phase: isOver ? 'finished' : 'in-round',
      window: null,
      round: isOver ? state.round : newRound,
    };
    return isOver ? { ...advanced, outcome: scoreFight(advanced) } : advanced;
  }

  // plan === 'submission'
  const p = submissionTapProbability(attacker.statLine, defender.statLine);
  const roll = rng();
  if (roll < p) {
    return {
      ...state,
      phase: 'finished',
      window: null,
      outcome: { winner: finisher, method: 'submission', round: state.round },
    };
  }

  // Failed tap: finisher pays stamina, close window, advance round (mirror finishStep failure).
  const drain = (s: number): number => Math.max(0, Math.min(STAMINA_MAX, s - GROUND_STAMINA_COST));
  const withDrain: FightState = finisher === 'player'
    ? { ...state, player: { ...state.player, stamina: drain(state.player.stamina) } }
    : { ...state, opponent: { ...state.opponent, stamina: drain(state.opponent.stamina) } };
  const advanced: FightState = {
    ...withDrain,
    phase: isOver ? 'finished' : 'in-round',
    window: null,
    round: isOver ? state.round : newRound,
  };
  return isOver ? { ...advanced, outcome: scoreFight(advanced) } : advanced;
}
