import type { FightState, RoundLogEntry } from './fightState';
import { opponentIntent } from './fightState';
import { scoreFight } from './judges';
import type { RoundIntent, StrikeTactic, Phase } from './intents';
import { intentPhase } from './intents';
import { PHASE_OFFENSE, PHASE_DEFENSE } from './stats';
import { staminaCost, recovery, effortMultiplier, STAMINA_MAX } from './stamina';
import { createRng } from '../rng';
import { detectWindow } from './finish';

// ── Tuning constants (adjust in Task 5) ──────────────────────────────────────
const IQ_FACTOR      = 0.1;
const SWING_RANGE    = 24;
const DMG_FACTOR     = 0.55;
const COUNTER_BONUS  = 10;
const BODY_TO_STAMINA = 0.5;
/** Stamina recovery lost per point of accumulated body damage carried into a round. */
const BODY_RECOVERY_FACTOR = 0.08;

const STRIKE_TACTIC_ATK: Record<StrikeTactic, number> = { pressure: 1.3, counter: 0.8, pickApart: 1.0 };
const STRIKE_TACTIC_DEF: Record<StrikeTactic, number> = { pressure: 0.8, counter: 1.2, pickApart: 1.0 };
// Interim wrestle constants (Task 1). Nudged above the spec's baselines (1.0 / 0.7)
// so exploiting a takedown-defense hole is a real edge while the ground window is
// absent; retuned in Task 5 once wrestle resolves through the ground game.
const WRESTLE_ATK = 1.1;
/** Shooting for a takedown leaves you open to strikes on the way in (<1). */
const WRESTLE_VS_STRIKE_DEF = 0.9;

/** Offensive multiplier for the attacker's intent. Wrestle has no tactic. */
function atkMult(intent: RoundIntent): number {
  return intent.kind === 'strike' ? STRIKE_TACTIC_ATK[intent.tactic] : WRESTLE_ATK;
}

/** Defensive multiplier for the defender's intent against an incoming phase. */
function defMult(defender: RoundIntent, incomingPhase: Phase): number {
  if (incomingPhase === 'wrestle') return 1.0; // takedownDef stat carries the defense
  // incoming strike:
  if (defender.kind === 'strike') return STRIKE_TACTIC_DEF[defender.tactic];
  return WRESTLE_VS_STRIKE_DEF; // shooting leaves you open (<1)
}

/** A striking Counter that meets a striking Pressure earns a clean-read bonus. */
function counterBonus(defender: RoundIntent, attacker: RoundIntent): number {
  return defender.kind === 'strike' && defender.tactic === 'counter' &&
    attacker.kind === 'strike' && attacker.tactic === 'pressure'
    ? COUNTER_BONUS
    : 0;
}

function clampStamina(s: number): number {
  return Math.max(0, Math.min(STAMINA_MAX, s));
}

/** Accumulated body damage suppresses recovery — a battered body doesn't bounce back. */
function bodyRecoveryPenalty(bodyDamage: number): number {
  return Math.round(bodyDamage * BODY_RECOVERY_FACTOR);
}

export function resolveRound(state: FightState, playerIntent: RoundIntent): FightState {
  if (state.phase !== 'in-round') {
    throw new Error(`resolveRound requires state.phase === "in-round" (got "${state.phase}")`);
  }
  const rng = createRng(`${state.seed}#f${state.fightNumber}#r${state.round}`);
  const oppIntent = opponentIntent(state);

  const seededSwing = (rng() - 0.5) * SWING_RANGE;

  const playerEffort = effortMultiplier(state.player.stamina);
  const oppEffort = effortMultiplier(state.opponent.stamina);

  const pPhase = intentPhase(playerIntent);
  const oPhase = intentPhase(oppIntent);

  // Two-sided exchange: each side mounts an attack in the phase it CHOSE, met by
  // the other side's defense against that phase. Both fighters' offense AND defense
  // stats, both stamina levels, and both intent choices feed the result.
  //
  //   attackScore = attacker.offense[phase]·effort·atkMult(intent)
  //               − defender.defense[phase]·effort·defMult(defenderIntent, phase)  (+ counter bonus)

  // Player attacks at pPhase; opponent defends there.
  const playerAttackScore =
    state.player.statLine[PHASE_OFFENSE[pPhase]] * playerEffort * atkMult(playerIntent) -
    state.opponent.statLine[PHASE_DEFENSE[pPhase]] * oppEffort * defMult(oppIntent, pPhase) +
    counterBonus(playerIntent, oppIntent);

  // Opponent attacks at oPhase; player defends there.
  const oppAttackScore =
    state.opponent.statLine[PHASE_OFFENSE[oPhase]] * oppEffort * atkMult(oppIntent) -
    state.player.statLine[PHASE_DEFENSE[oPhase]] * playerEffort * defMult(playerIntent, oPhase) +
    counterBonus(oppIntent, playerIntent);

  const dominance =
    playerAttackScore - oppAttackScore +
    (state.player.statLine.fightIQ - state.opponent.statLine.fightIQ) * IQ_FACTOR +
    seededSwing;

  // Damage to the round loser. Damage type = winner's target if the winner struck,
  // else 'head' (interim: a winning wrestle just deals head damage until Task 2's
  // ground window arrives).
  const dmg = Math.round(Math.abs(dominance) * DMG_FACTOR);
  let playerHead = state.player.headDamage;
  let playerBody = state.player.bodyDamage;
  let oppHead    = state.opponent.headDamage;
  let oppBody    = state.opponent.bodyDamage;

  let playerStamina = state.player.stamina;
  let oppStamina    = state.opponent.stamina;

  if (dominance > 0) {
    // Player wins the exchange — opponent absorbs damage
    if (playerIntent.kind === 'strike' && playerIntent.target === 'body') {
      oppBody    += dmg;
      oppStamina -= Math.round(dmg * BODY_TO_STAMINA);
    } else {
      oppHead += dmg;
    }
  } else if (dominance < 0) {
    // Opponent wins the exchange — player absorbs damage; winner's target drives type
    if (oppIntent.kind === 'strike' && oppIntent.target === 'body') {
      playerBody    += dmg;
      playerStamina -= Math.round(dmg * BODY_TO_STAMINA);
    } else {
      playerHead += dmg;
    }
  }

  // Stamina: subtract effort cost, add recovery (suppressed by carried body damage), clamp
  playerStamina = clampStamina(
    playerStamina - staminaCost(playerIntent)
      + recovery(state.player.statLine) - bodyRecoveryPenalty(state.player.bodyDamage)
  );
  oppStamina = clampStamina(
    oppStamina - staminaCost(oppIntent)
      + recovery(state.opponent.statLine) - bodyRecoveryPenalty(state.opponent.bodyDamage)
  );

  // Round scoring: winner +1 plus a margin bonus
  const margin = Math.floor(Math.abs(dominance) / 10);
  let playerScore = state.player.roundScore;
  let oppScore    = state.opponent.roundScore;
  if (dominance > 0) {
    playerScore += 1 + margin;
  } else if (dominance < 0) {
    oppScore += 1 + margin;
  }

  const winner: 'player' | 'opponent' | 'draw' =
    dominance > 0 ? 'player' : dominance < 0 ? 'opponent' : 'draw';

  const logEntry: RoundLogEntry = {
    round: state.round,
    playerIntent,
    opponentIntent: oppIntent,
    winner,
    dominance,
  };

  // Finish detection: open a window instead of advancing when triggered
  const finishWindow = detectWindow({
    prePlayerHeadDamage: state.player.headDamage,
    preOpponentHeadDamage: state.opponent.headDamage,
    playerHeadDamage: playerHead,
    opponentHeadDamage: oppHead,
    playerStamina,
    opponentStamina: oppStamina,
    playerStatLine: state.player.statLine,
    opponentStatLine: state.opponent.statLine,
    dominance,
    playerIntent,
    opponentIntent: oppIntent,
  });

  if (finishWindow) {
    return {
      ...state,
      // round is NOT advanced — the finish sequence resolves this moment
      phase: 'finish-window',
      window: finishWindow,
      player: {
        ...state.player,
        headDamage: playerHead,
        bodyDamage: playerBody,
        stamina: playerStamina,
        roundScore: playerScore,
      },
      opponent: {
        ...state.opponent,
        headDamage: oppHead,
        bodyDamage: oppBody,
        stamina: oppStamina,
        roundScore: oppScore,
      },
      log: [...state.log, logEntry],
    };
  }

  const isLastRound = state.round >= state.rounds;

  const resolvedPlayer = {
    ...state.player,
    headDamage: playerHead,
    bodyDamage: playerBody,
    stamina: playerStamina,
    roundScore: playerScore,
  };
  const resolvedOpponent = {
    ...state.opponent,
    headDamage: oppHead,
    bodyDamage: oppBody,
    stamina: oppStamina,
    roundScore: oppScore,
  };

  if (isLastRound) {
    // Build the fully-resolved final state so scoreFight sees the last round's scores.
    const finalBase: FightState = {
      ...state,
      round: state.round,
      phase: 'finished',
      player: resolvedPlayer,
      opponent: resolvedOpponent,
      log: [...state.log, logEntry],
    };
    return {
      ...finalBase,
      round: state.round,
      outcome: scoreFight(finalBase),
    };
  }

  return {
    ...state,
    round: state.round + 1,
    phase: 'in-round',
    outcome: null,
    player: resolvedPlayer,
    opponent: resolvedOpponent,
    log: [...state.log, logEntry],
  };
}
