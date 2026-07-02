import type { FightState, RoundLogEntry } from './fightState';
import { opponentIntent } from './fightState';
import type { RoundIntent, Approach } from './intents';
import { PHASE_OFFENSE, PHASE_DEFENSE } from './stats';
import { staminaCost, recovery, effortMultiplier, STAMINA_MAX } from './stamina';
import { createRng } from '../rng';

// ── Tuning constants (adjust in Task 11) ─────────────────────────────────────
const IQ_FACTOR      = 0.1;
const SWING_RANGE    = 24;
const DMG_FACTOR     = 0.08;
const COUNTER_BONUS  = 10;
const BODY_TO_STAMINA = 0.5;

const APPROACH_ATK: Record<Approach, number> = { pressure: 1.3, technical: 1.0, counter: 0.8 };
const APPROACH_DEF: Record<Approach, number> = { pressure: 0.8, technical: 1.0, counter: 1.2 };

function clampStamina(s: number): number {
  return Math.max(0, Math.min(STAMINA_MAX, s));
}

export function resolveRound(state: FightState, playerIntent: RoundIntent): FightState {
  const rng = createRng(`${state.seed}#f${state.fightNumber}#r${state.round}`);
  const oppIntent = opponentIntent(state);

  const seededSwing = (rng() - 0.5) * SWING_RANGE;

  // Effective offense: attacker's stat × effort × approach attack multiplier
  const playerOffense =
    state.player.statLine[PHASE_OFFENSE[playerIntent.where]] *
    effortMultiplier(state.player.stamina) *
    APPROACH_ATK[playerIntent.approach];

  // Effective defense: defender's stat × effort × approach defense multiplier + counter bonus
  const counterBonus =
    oppIntent.approach === 'counter' && playerIntent.approach === 'pressure' ? COUNTER_BONUS : 0;
  const oppDefense =
    state.opponent.statLine[PHASE_DEFENSE[playerIntent.where]] *
    effortMultiplier(state.opponent.stamina) *
    APPROACH_DEF[oppIntent.approach] +
    counterBonus;

  const dominance =
    playerOffense - oppDefense +
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

  // Stamina: subtract effort cost, add recovery, clamp
  playerStamina = clampStamina(
    playerStamina - staminaCost(playerIntent.where, playerIntent.approach) + recovery(state.player.statLine)
  );
  oppStamina = clampStamina(
    oppStamina - staminaCost(oppIntent.where, oppIntent.approach) + recovery(state.opponent.statLine)
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

  const isLastRound = state.round >= state.rounds;
  // TEMP: replaced by judges in Task 10
  const nextPhase = isLastRound ? 'finished' : 'in-round';

  return {
    ...state,
    round: state.round + 1,
    phase: nextPhase,
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
