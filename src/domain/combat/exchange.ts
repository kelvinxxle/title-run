import type { FightState, RoundLogEntry, Fighter2 } from './fightState';
import { opponentMove } from './fightState';
import { scoreFight } from './judges';
import type { ExchangeMove } from './intents';
import { movePhase } from './intents';
import { STRIKES } from './strikes';
import { PHASE_OFFENSE, PHASE_DEFENSE } from './stats';
import {
  recovery, effortMultiplier, mobilityMultiplier, STAMINA_MAX, isGassed,
} from './stamina';
import { createRng } from '../rng';
import {
  detectWindow, INITIAL_STEPS, chooseGroundPlan, groundAndPoundDamage, ROCKED_HEAD_DMG,
} from './finish';
import { gamePlanEffect } from './gameplan';
import { buildRoundReport, type RoundReport } from './report';

export const EXCHANGES_PER_ROUND = 3;

// ── Tuning constants — ported verbatim from the retired resolveRound (retune in Task 7) ──
const IQ_FACTOR = 0.1;
const SWING_RANGE = 24;
const DMG_FACTOR = 0.55;
const COUNTER_BONUS = 10;
const BODY_TO_STAMINA = 0.5;
/** Stamina recovery lost per point of accumulated body damage carried into a round. */
const BODY_RECOVERY_FACTOR = 0.08;
/** A takedown shoot is a whole-body commitment — kept at the retired WRESTLE_COST value. */
const TAKEDOWN_COST = 17;
// M15 T7 (balance GATE): TAKEDOWN_ATK 1.1→1.25. GSP's elite wrestling (takedowns=90) is the
// skill lever careless never uses (it only spams powerPunch), so raising takedown offense lifts
// good's late win rate over Tier-5 champions to BAND-3 (≥0.45) without moving careless, whose
// predictable head-hunting stays capped by the adaptive counter (BAND 5, ≤0.42). See balance.test.ts.
const TAKEDOWN_ATK = 1.25;
/** Shooting for a takedown leaves you open to strikes on the way in (<1). */
const TAKEDOWN_VS_STRIKE_DEF = 0.9;

function clampStamina(s: number): number {
  return Math.max(0, Math.min(STAMINA_MAX, s));
}

/** Accumulated body damage suppresses recovery — a battered body doesn't bounce back. */
function bodyRecoveryPenalty(bodyDamage: number): number {
  return Math.round(bodyDamage * BODY_RECOVERY_FACTOR);
}

/** Offensive multiplier for a move. */
function atkMult(move: ExchangeMove): number {
  return move.kind === 'strike' ? STRIKES[move.strike].atkMult : TAKEDOWN_ATK;
}

/** Defensive exposure of the DEFENDER's chosen move against an incoming phase. */
function defMult(defender: ExchangeMove, incomingPhase: 'strike' | 'wrestle'): number {
  if (incomingPhase === 'wrestle') return 1.0; // takedownDef stat carries the defense
  return defender.kind === 'strike' ? STRIKES[defender.strike].defMult : TAKEDOWN_VS_STRIKE_DEF;
}

/** Timing read: a fast defender strike punishes a slow, high-commit attacker strike. */
function timingBonus(defender: ExchangeMove, attacker: ExchangeMove): number {
  if (defender.kind !== 'strike' || attacker.kind !== 'strike') return 0;
  const gap = STRIKES[defender.strike].speed - STRIKES[attacker.strike].speed;
  return gap > 0 ? Math.round(COUNTER_BONUS * gap) : 0;
}

type Opp = Fighter2 & { name: string; archetype: string };

function makeReport(
  round: number,
  winner: 'player' | 'opponent' | 'draw',
  dominance: number,
  playerMove: ExchangeMove,
  oppMove: ExchangeMove,
  pre: FightState,
  p: Fighter2,
  o: Opp,
): RoundReport {
  return buildRoundReport({
    round,
    winner,
    dominance,
    playerIntent: playerMove,
    opponentIntent: oppMove,
    playerHeadDelta: Math.max(0, p.headDamage - pre.player.headDamage),
    playerBodyDelta: Math.max(0, p.bodyDamage - pre.player.bodyDamage),
    opponentHeadDelta: Math.max(0, o.headDamage - pre.opponent.headDamage),
    opponentBodyDelta: Math.max(0, o.bodyDamage - pre.opponent.bodyDamage),
    playerBecameRocked:
      pre.player.headDamage < ROCKED_HEAD_DMG(pre.player.statLine.chin) &&
      p.headDamage >= ROCKED_HEAD_DMG(pre.player.statLine.chin),
    opponentBecameRocked:
      pre.opponent.headDamage < ROCKED_HEAD_DMG(pre.opponent.statLine.chin) &&
      o.headDamage >= ROCKED_HEAD_DMG(pre.opponent.statLine.chin),
    playerGassed: isGassed(p.stamina),
    opponentGassed: isGassed(o.stamina),
  });
}

/**
 * Resolve one beat of a round. Requires `state.phase === 'in-round'`.
 *
 * Branch order: a winning player takedown opens a ground-window (round frozen); a
 * winning opponent takedown resolves an AI ground action (submission/GnP finish
 * window, or a non-rocking GnP that advances the round); otherwise a strike
 * exchange applies damage and either freezes on a finish window, advances the
 * exchange, or — on the last beat — crosses the round boundary (recovery applied).
 */
export function resolveExchange(state: FightState, playerMove: ExchangeMove): FightState {
  if (state.phase !== 'in-round') {
    throw new Error(`resolveExchange requires state.phase === "in-round" (got "${state.phase}")`);
  }
  const oppMove = opponentMove(state);
  const plan = gamePlanEffect(state.gamePlan);
  const rng = createRng(`${state.seed}#f${state.fightNumber}#r${state.round}#x${state.exchange}`);
  const seededSwing = (rng() - 0.5) * SWING_RANGE;

  const pEffort = effortMultiplier(state.player.stamina) * mobilityMultiplier(state.player.legDamage);
  const oEffort = effortMultiplier(state.opponent.stamina) * mobilityMultiplier(state.opponent.legDamage);

  const pPhase = movePhase(playerMove);
  const oPhase = movePhase(oppMove);

  // Two-sided exchange — identical formula to the retired resolveRound, with the
  // per-side multipliers/target now sourced from the move's strike profile.
  const playerAttackScore =
    state.player.statLine[PHASE_OFFENSE[pPhase]] * pEffort * atkMult(playerMove) * plan.atkMult -
    state.opponent.statLine[PHASE_DEFENSE[pPhase]] * oEffort * defMult(oppMove, pPhase) +
    timingBonus(playerMove, oppMove);

  const oppAttackScore =
    state.opponent.statLine[PHASE_OFFENSE[oPhase]] * oEffort * atkMult(oppMove) -
    state.player.statLine[PHASE_DEFENSE[oPhase]] * pEffort * defMult(playerMove, oPhase) * plan.defMult +
    timingBonus(oppMove, playerMove);

  const dominance =
    playerAttackScore - oppAttackScore +
    (state.player.statLine.fightIQ - state.opponent.statLine.fightIQ) * IQ_FACTOR +
    seededSwing;

  const pCost = playerMove.kind === 'strike' ? STRIKES[playerMove.strike].staminaCost : TAKEDOWN_COST;
  const oCost = oppMove.kind === 'strike' ? STRIKES[oppMove.strike].staminaCost : TAKEDOWN_COST;
  const margin = Math.floor(Math.abs(dominance) / 10);
  const winner: 'player' | 'opponent' | 'draw' = dominance > 0 ? 'player' : dominance < 0 ? 'opponent' : 'draw';
  const logEntry: RoundLogEntry = {
    round: state.round,
    exchange: state.exchange,
    playerIntent: playerMove,
    opponentIntent: oppMove,
    winner,
    dominance,
  };

  /**
   * Advance to the next round (or finish the fight) applying the round-boundary stamina.
   *
   * Recovery economy note: this function is called ONLY for normal last-beat strike rounds
   * and for the opponent-takedown no-rock path below. Rounds that cash out through an
   * interim takedown/finish WINDOW (player takedown → ground-window → groundStep; any
   * finish-window → finishStep) advance to the next round via finish.ts's own inline
   * round-advance WITHOUT re-applying this recovery. This diverges from M14's resolveRound,
   * which applied recovery at window-open; M15 does not — window-resolved rounds forgo it.
   * This is intentional and gate-locked: T7 validated this economy empirically across 300
   * seeds; M16's full ground tree will revisit the timing.
   */
  function crossRoundBoundary(p: Fighter2, o: Opp): FightState {
    const pRb = clampStamina(
      p.stamina + recovery(state.player.statLine) - bodyRecoveryPenalty(p.bodyDamage) + plan.staminaDelta,
    );
    const oRb = clampStamina(
      o.stamina + recovery(state.opponent.statLine) - bodyRecoveryPenalty(o.bodyDamage),
    );
    const p2: Fighter2 = { ...p, stamina: pRb };
    const o2: Opp = { ...o, stamina: oRb };
    const base = { ...state, player: p2, opponent: o2, log: [...state.log, logEntry] };
    if (state.round >= state.rounds) {
      const finalBase: FightState = { ...base, exchange: 1, phase: 'finished', window: null, gamePlan: null, outcome: null };
      return { ...finalBase, outcome: scoreFight(finalBase) };
    }
    return { ...base, exchange: 1, round: state.round + 1, phase: 'corner', window: null, gamePlan: null, outcome: null };
  }

  // ── Player takedown lands (dominance > 0) → open a ground-window, freeze the round ──
  if (dominance > 0 && playerMove.kind === 'takedown') {
    const p: Fighter2 = { ...state.player, stamina: clampStamina(state.player.stamina - pCost), roundScore: state.player.roundScore + 1 + margin };
    const o: Opp = { ...state.opponent, stamina: clampStamina(state.opponent.stamina - oCost) };
    const report = makeReport(state.round, 'player', dominance, playerMove, oppMove, state, p, o);
    // Round is suspended here (frozen at current exchange); cashes out via groundStep
    // without round-boundary recovery (interim M15 economy; revisit in M16).
    return {
      ...state,
      phase: 'ground-window',
      window: { side: 'player', method: 'ground', stepsLeft: INITIAL_STEPS },
      gamePlan: null,
      lastReport: report,
      player: p,
      opponent: o,
      log: [...state.log, logEntry],
    };
  }

  // ── Opponent takedown lands (dominance < 0) → AI ground action ──
  if (dominance < 0 && oppMove.kind === 'takedown') {
    const oppScoreAfter = state.opponent.roundScore + 1 + margin;
    const pBase: Fighter2 = { ...state.player, stamina: clampStamina(state.player.stamina - pCost) };
    const oBase: Opp = { ...state.opponent, stamina: clampStamina(state.opponent.stamina - oCost), roundScore: oppScoreAfter };

    const oppPlan = chooseGroundPlan(state.player.statLine);
    if (oppPlan === 'submission') {
      // Defensible submission window — no head damage; round frozen.
      const report = makeReport(state.round, 'opponent', dominance, playerMove, oppMove, state, pBase, oBase);
      return {
        ...state,
        phase: 'finish-window',
        window: { side: 'opponent', method: 'submission', stepsLeft: INITIAL_STEPS },
        gamePlan: null,
        lastReport: report,
        player: pBase,
        opponent: oBase,
        log: [...state.log, logEntry],
      };
    }

    // ground-and-pound: deterministic damage to the player's head.
    const gpDmg = groundAndPoundDamage(state.opponent.statLine, state.player.statLine);
    const preHead = state.player.headDamage;
    const postHead = preHead + gpDmg;
    const rocked = ROCKED_HEAD_DMG(state.player.statLine.chin);
    const pGnp: Fighter2 = { ...pBase, headDamage: postHead };
    const report = makeReport(state.round, 'opponent', dominance, playerMove, oppMove, state, pGnp, oBase);

    if (preHead < rocked && postHead >= rocked) {
      // Rock → opponent-side KO finish window; round frozen, player defends.
      return {
        ...state,
        phase: 'finish-window',
        window: { side: 'opponent', method: 'KO', stepsLeft: INITIAL_STEPS },
        gamePlan: null,
        lastReport: report,
        player: pGnp,
        opponent: oBase,
        log: [...state.log, logEntry],
      };
    }

    // No rock → partial damage; advance the round (round-boundary stamina applied).
    return { ...crossRoundBoundary(pGnp, oBase), lastReport: report };
  }

  // ── Strike exchange ──
  const winnerMove = dominance > 0 ? playerMove : oppMove;
  const power = winnerMove.kind === 'strike' ? STRIKES[winnerMove.strike].power : 1;
  const target = winnerMove.kind === 'strike' ? STRIKES[winnerMove.strike].target : 'head';
  const dmg = Math.round(Math.abs(dominance) * DMG_FACTOR * power);

  const p: Fighter2 = { ...state.player };
  const o: Opp = { ...state.opponent };

  if (dominance > 0) {
    if (target === 'body') { o.bodyDamage += dmg; o.stamina -= Math.round(dmg * BODY_TO_STAMINA); }
    else if (target === 'legs') { o.legDamage += dmg; }
    else { o.headDamage += dmg; }
    p.roundScore += 1 + margin;
  } else if (dominance < 0) {
    if (target === 'body') { p.bodyDamage += dmg; p.stamina -= Math.round(dmg * BODY_TO_STAMINA); }
    else if (target === 'legs') { p.legDamage += dmg; }
    else { p.headDamage += dmg; }
    o.roundScore += 1 + margin;
  }

  // Per-beat stamina COST only (no recovery mid-round).
  p.stamina = clampStamina(p.stamina - pCost);
  o.stamina = clampStamina(o.stamina - oCost);

  const report = makeReport(state.round, winner, dominance, playerMove, oppMove, state, p, o);

  // Finish detection freezes the round + exchange.
  const finishWindow = detectWindow({
    prePlayerHeadDamage: state.player.headDamage,
    preOpponentHeadDamage: state.opponent.headDamage,
    playerHeadDamage: p.headDamage,
    opponentHeadDamage: o.headDamage,
    playerStamina: p.stamina,
    opponentStamina: o.stamina,
    playerStatLine: state.player.statLine,
    opponentStatLine: state.opponent.statLine,
    dominance,
    playerIntent: playerMove,
    opponentIntent: oppMove,
  });

  const base = { ...state, player: p, opponent: o, log: [...state.log, logEntry], lastReport: report };
  if (finishWindow) {
    return { ...base, phase: 'finish-window', window: finishWindow, gamePlan: null };
  }

  // Not the last beat → advance the exchange, same round, no recovery.
  if (state.exchange < EXCHANGES_PER_ROUND) {
    return { ...base, exchange: state.exchange + 1 };
  }

  // Last beat of the round → cross the round boundary.
  return { ...crossRoundBoundary(p, o), lastReport: report };
}
