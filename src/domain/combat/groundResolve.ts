// src/domain/combat/groundResolve.ts
import type { FightState, Fighter2 } from './fightState';
import { EXCHANGES_PER_ROUND, crossRoundBoundary, clampStamina } from './exchange';
import type { GroundAction, GroundPosition } from './ground';
import { nextPosition, POSITION_SUBMISSION } from './ground';
import {
  groundPoundDamage, groundSubProbability, advanceProbability, escapeProbability,
  GND_POUND_COST, GND_ADVANCE_COST, GND_SUBFAIL_COST,
} from './groundEngine';
import { ROCKED_HEAD_DMG, INITIAL_STEPS } from './finish';
import { buildGroundReport } from './report';
import { gamePlanEffect } from './gameplan';
import { isGassed } from './stamina';
import { createRng } from '../rng';

function settleGroundBeat(
  state: FightState,
  p: Fighter2,
  o: FightState['opponent'],
  position: GroundPosition,
  escaped: boolean,
  nextExchange: number,
  atBoundary: boolean,
  planStaminaDelta: number,
  report: ReturnType<typeof buildGroundReport>,
): FightState {
  if (atBoundary) {
    // End of the beat budget → normal round boundary (recovery applied), same economy as strikes.
    return { ...crossRoundBoundary(state, p, o, planStaminaDelta, state.log), ground: null, lastReport: report };
  }
  if (escaped) {
    // Opponent scrambles up → back to standing for the remaining beats of this round.
    return { ...state, phase: 'in-round', exchange: nextExchange, ground: null, window: null, player: p, opponent: o, lastReport: report };
  }
  // Stay on the ground for the next beat.
  return { ...state, phase: 'ground', exchange: nextExchange, ground: { position }, window: null, player: p, opponent: o, lastReport: report };
}

export function resolveGround(state: FightState, action: GroundAction): FightState {
  if (state.phase !== 'ground') {
    throw new Error(`resolveGround requires state.phase === "ground" (got "${state.phase}")`);
  }
  if (!state.ground) throw new Error('resolveGround requires state.ground to be set');

  const position = state.ground.position;
  const plan = gamePlanEffect(state.gamePlan);
  const rng = createRng(`${state.seed}#f${state.fightNumber}#r${state.round}#g${state.exchange}`);

  // Player is always top in the ground phase (only player takedowns enter here — scope cut).
  const attacker = state.player;
  const defender = state.opponent;
  const defenderGassed = isGassed(defender.stamina);
  const nextExchange = state.exchange + 1;
  const atBoundary = nextExchange > EXCHANGES_PER_ROUND;
  const rollEscape = () => rng() < escapeProbability(attacker.statLine, defender.statLine);

  if (action === 'submission') {
    const chance = groundSubProbability(attacker.statLine, defender.statLine, position, defenderGassed);
    const roll = rng();
    if (POSITION_SUBMISSION[position] !== null && roll < chance) {
      const report = buildGroundReport({ round: state.round, action, position, success: true, opponentHeadDelta: 0, escaped: false, submitted: true });
      return { ...state, phase: 'finished', ground: null, window: null, lastReport: report, outcome: { winner: 'player', method: 'submission', round: state.round } };
    }
    const p: Fighter2 = { ...state.player, stamina: clampStamina(state.player.stamina - GND_SUBFAIL_COST) };
    const escaped = rollEscape();
    const report = buildGroundReport({ round: state.round, action, position, success: false, opponentHeadDelta: 0, escaped, submitted: false });
    return settleGroundBeat(state, p, state.opponent, position, escaped, nextExchange, atBoundary, plan.staminaDelta, report);
  }

  if (action === 'advance') {
    const np = nextPosition(position);
    let newPos = position; let scored = 0; let success = false;
    if (np === null) { success = true; scored = 1; }                // already at back → hold, score control
    else if (rng() < advanceProbability(attacker.statLine, defender.statLine)) { newPos = np; success = true; scored = 1; }
    const p: Fighter2 = { ...state.player, stamina: clampStamina(state.player.stamina - GND_ADVANCE_COST), roundScore: state.player.roundScore + scored };
    const escaped = rollEscape();
    const report = buildGroundReport({ round: state.round, action, position: newPos, success, opponentHeadDelta: 0, escaped, submitted: false });
    return settleGroundBeat(state, p, state.opponent, newPos, escaped, nextExchange, atBoundary, plan.staminaDelta, report);
  }

  // ground-and-pound
  const dmg = groundPoundDamage(attacker.statLine, defender.statLine, position);
  const preHead = defender.headDamage;
  const postHead = preHead + dmg;
  const rocked = ROCKED_HEAD_DMG(defender.statLine.chin);
  const o: FightState['opponent'] = { ...state.opponent, headDamage: postHead };
  const p: Fighter2 = { ...state.player, stamina: clampStamina(state.player.stamina - GND_POUND_COST), roundScore: state.player.roundScore + 1 };
  if (preHead < rocked && postHead >= rocked) {
    // Rock → reuse the KO finish window (player-side); leave the ground phase.
    const report = buildGroundReport({ round: state.round, action, position, success: true, opponentHeadDelta: dmg, escaped: false, submitted: false });
    return { ...state, phase: 'finish-window', ground: null, window: { side: 'player', method: 'KO', stepsLeft: INITIAL_STEPS }, gamePlan: null, lastReport: report, player: p, opponent: o };
  }
  const escaped = rollEscape();
  const report = buildGroundReport({ round: state.round, action, position, success: true, opponentHeadDelta: dmg, escaped, submitted: false });
  return settleGroundBeat(state, p, o, position, escaped, nextExchange, atBoundary, plan.staminaDelta, report);
}
