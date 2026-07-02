import type { FightState, RoundLogEntry } from './fightState';
import { opponentIntent } from './fightState';
import { scoreFight } from './judges';
import type { RoundIntent, Approach } from './intents';
import { PHASE_OFFENSE, PHASE_DEFENSE } from './stats';
import { staminaCost, recovery, effortMultiplier, STAMINA_MAX } from './stamina';
import { createRng } from '../rng';
import { detectWindow } from './finish';

// ── Tuning constants (adjust in Task 11) ─────────────────────────────────────
const IQ_FACTOR      = 0.1;
const SWING_RANGE    = 24;
const DMG_FACTOR     = 0.55;
const COUNTER_BONUS  = 10;
const BODY_TO_STAMINA = 0.5;
/** Stamina recovery lost per point of accumulated body damage carried into a round. */
const BODY_RECOVERY_FACTOR = 0.08;

const APPROACH_ATK: Record<Approach, number> = { pressure: 1.3, technical: 1.0, counter: 0.8 };
const APPROACH_DEF: Record<Approach, number> = { pressure: 0.8, technical: 1.0, counter: 1.2 };

function clampStamina(s: number): number {
  return Math.max(0, Math.min(STAMINA_MAX, s));
}

/** Accumulated body damage suppresses recovery — a battered body doesn't bounce back. */
function bodyRecoveryPenalty(bodyDamage: number): number {
  return Math.round(bodyDamage * BODY_RECOVERY_FACTOR);
}

export function resolveRound(state: FightState, playerIntent: RoundIntent): FightState {
  const rng = createRng(`${state.seed}#f${state.fightNumber}#r${state.round}`);
  const oppIntent = opponentIntent(state);

  const seededSwing = (rng() - 0.5) * SWING_RANGE;

  const playerEffort = effortMultiplier(state.player.stamina);
  const oppEffort = effortMultiplier(state.opponent.stamina);

  // Two-sided exchange: each side mounts an attack in the phase it CHOSE, met by
  // the other side's defense in that same phase. Both fighters' offense AND defense
  // stats, both stamina levels, and both `where` choices feed the result.
  //
  //   attackScore = attacker.offense[where]·effort·ATK[approach]
  //               − defender.defense[where]·effort·DEF[approach]  (+ counter bonus)

  // Player attacks at playerIntent.where; opponent defends there with oppIntent.approach.
  const playerCounterBonus =
    playerIntent.approach === 'counter' && oppIntent.approach === 'pressure' ? COUNTER_BONUS : 0;
  const playerAttackScore =
    state.player.statLine[PHASE_OFFENSE[playerIntent.where]] * playerEffort * APPROACH_ATK[playerIntent.approach] -
    state.opponent.statLine[PHASE_DEFENSE[playerIntent.where]] * oppEffort * APPROACH_DEF[oppIntent.approach] +
    playerCounterBonus;

  // Opponent attacks at oppIntent.where; player defends there with playerIntent.approach.
  const oppCounterBonus =
    oppIntent.approach === 'counter' && playerIntent.approach === 'pressure' ? COUNTER_BONUS : 0;
  const oppAttackScore =
    state.opponent.statLine[PHASE_OFFENSE[oppIntent.where]] * oppEffort * APPROACH_ATK[oppIntent.approach] -
    state.player.statLine[PHASE_DEFENSE[oppIntent.where]] * playerEffort * APPROACH_DEF[playerIntent.approach] +
    oppCounterBonus;

  const dominance =
    playerAttackScore - oppAttackScore +
    (state.player.statLine.fightIQ - state.opponent.statLine.fightIQ) * IQ_FACTOR +
    seededSwing;

  // Damage to the round loser
  const dmg = Math.round(Math.abs(dominance) * DMG_FACTOR);
  let playerHead = state.player.headDamage;
  let playerBody = state.player.bodyDamage;
  let oppHead    = state.opponent.headDamage;
  let oppBody    = state.opponent.bodyDamage;

  let playerStamina = state.player.stamina;
  let oppStamina    = state.opponent.stamina;

  if (dominance > 0) {
    // Player wins the exchange — opponent absorbs damage
    if (playerIntent.target === 'body') {
      oppBody    += dmg;
      oppStamina -= Math.round(dmg * BODY_TO_STAMINA);
    } else {
      oppHead += dmg;
    }
  } else if (dominance < 0) {
    // Opponent wins the exchange — player absorbs damage; winner's target drives damage type
    if (oppIntent.target === 'body') {
      playerBody    += dmg;
      playerStamina -= Math.round(dmg * BODY_TO_STAMINA);
    } else {
      playerHead += dmg;
    }
  }

  // Stamina: subtract effort cost, add recovery (suppressed by carried body damage), clamp
  playerStamina = clampStamina(
    playerStamina - staminaCost(playerIntent.where, playerIntent.approach)
      + recovery(state.player.statLine) - bodyRecoveryPenalty(state.player.bodyDamage)
  );
  oppStamina = clampStamina(
    oppStamina - staminaCost(oppIntent.where, oppIntent.approach)
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
