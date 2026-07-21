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
import { TAKEDOWN_PROFILES } from './takedown';
import { getSignatureMoveById } from './signatures';
import { buildResolvedBeat, type BeatDeltas, type BeatStatus, type BeatOutcome, type BeatMoveClass } from './beat';

export const EXCHANGES_PER_ROUND = 3;

// ── Tuning constants — ported verbatim from the retired resolveRound (retune in Task 7) ──
const IQ_FACTOR = 0.1;
const SWING_RANGE = 24;
const DMG_FACTOR = 0.55;
const COUNTER_BONUS = 10;
const BODY_TO_STAMINA = 0.5;
/** Stamina recovery lost per point of accumulated body damage carried into a round. */
const BODY_RECOVERY_FACTOR = 0.08;
/** Shooting for a takedown leaves you open to strikes on the way in (<1). */
const TAKEDOWN_VS_STRIKE_DEF = 0.9;

// ── M17 Signature charge constants (tuned in T6) ───────────────────────────
/** Base charge gain on any player-winning beat. */
export const SIGNATURE_CHARGE_GAIN = 18;
/** Additional charge per point of dominance (scales charge with how well you won). */
export const SIGNATURE_CHARGE_DOM = 0.15;

/**
 * True when the player's signature is fully charged and can be detonated.
 * Gate: only the StrikePanel UI (and the guard in resolveExchange) should call this.
 */
export function signatureReady(state: FightState): boolean {
  return state.signatureCharge >= 100;
}

export function clampStamina(s: number): number {
  return Math.max(0, Math.min(STAMINA_MAX, s));
}

/** Accumulated body damage suppresses recovery — a battered body doesn't bounce back. */
function bodyRecoveryPenalty(bodyDamage: number): number {
  return Math.round(bodyDamage * BODY_RECOVERY_FACTOR);
}

/** Offensive multiplier for a move. Signature case handled before this helper (returns placeholder). */
function atkMult(move: ExchangeMove): number {
  if (move.kind === 'signature') return 1.0; // placeholder; T4 handles signature before this
  return move.kind === 'strike' ? STRIKES[move.strike].atkMult : TAKEDOWN_PROFILES[move.takedownType].atkMult;
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

// ── Beat assembly helpers (M18) ───────────────────────────────────────────────

function makeBeatDeltas(state: FightState, p: Fighter2, o: FightState['opponent']): BeatDeltas {
  return {
    playerHead: p.headDamage - state.player.headDamage,
    playerBody: p.bodyDamage - state.player.bodyDamage,
    playerLeg: p.legDamage - state.player.legDamage,
    playerStamina: p.stamina - state.player.stamina,
    opponentHead: o.headDamage - state.opponent.headDamage,
    opponentBody: o.bodyDamage - state.opponent.bodyDamage,
    opponentLeg: o.legDamage - state.opponent.legDamage,
    opponentStamina: o.stamina - state.opponent.stamina,
  };
}

function makeBeatStatus(state: FightState, p: Fighter2, o: FightState['opponent']): BeatStatus {
  return {
    playerBecameRocked: state.player.headDamage < ROCKED_HEAD_DMG(state.player.statLine.chin) && p.headDamage >= ROCKED_HEAD_DMG(state.player.statLine.chin),
    opponentBecameRocked: state.opponent.headDamage < ROCKED_HEAD_DMG(state.opponent.statLine.chin) && o.headDamage >= ROCKED_HEAD_DMG(state.opponent.statLine.chin),
    playerGassed: isGassed(p.stamina),
    opponentGassed: isGassed(o.stamina),
  };
}

/**
 * Advance to the next round (or finish the fight) applying the round-boundary stamina economy.
 * Extracted to module scope so groundResolve.ts can reuse it for ground beats at round boundary.
 */
export function crossRoundBoundary(
  state: FightState,
  p: Fighter2,
  o: FightState['opponent'],
  planStaminaDelta: number,
  log: RoundLogEntry[],
): FightState {
  const pRb = clampStamina(
    p.stamina + recovery(state.player.statLine) - bodyRecoveryPenalty(p.bodyDamage) + planStaminaDelta,
  );
  const oRb = clampStamina(
    o.stamina + recovery(state.opponent.statLine) - bodyRecoveryPenalty(o.bodyDamage),
  );
  const p2: Fighter2 = { ...p, stamina: pRb };
  const o2: FightState['opponent'] = { ...o, stamina: oRb };
  const base = { ...state, player: p2, opponent: o2, log };
  if (state.round >= state.rounds) {
    const finalBase: FightState = { ...base, exchange: state.exchange, phase: 'finished', window: null, gamePlan: null, outcome: null };
    return { ...finalBase, outcome: scoreFight(finalBase) };
  }
  return { ...base, exchange: 1, round: state.round + 1, phase: 'corner', window: null, gamePlan: null, outcome: null };
}

/**
 * Resolve one beat of a round. Requires `state.phase === 'in-round'`.
 *
 * Branch order: a winning player takedown enters the ground phase (real beat budget consumed);
 * a winning opponent takedown resolves an AI ground action (submission/GnP finish window, or a
 * non-rocking GnP that advances the round); otherwise a strike exchange applies damage and
 * either freezes on a finish window, advances the exchange, or — on the last beat — crosses the
 * round boundary (recovery applied).
 */
export function resolveExchange(state: FightState, playerMove: ExchangeMove): FightState {
  if (state.phase !== 'in-round') {
    throw new Error(`resolveExchange requires state.phase === "in-round" (got "${state.phase}")`);
  }

  // ── M17: Signature detonation ─────────────────────────────────────────────
  if (playerMove.kind === 'signature') {
    if (!signatureReady(state)) {
      throw new Error('resolveExchange: signature is not ready (signatureCharge < 100)');
    }
    // Resolve through the same two-sided exchange math, using the SignatureMove profile.
    const sigMove = getSignatureMoveById(state.signatureId);
    const oppMove = opponentMove(state);
    const plan = gamePlanEffect(state.gamePlan);
    const rng = createRng(`${state.seed}#f${state.fightNumber}#r${state.round}#x${state.exchange}`);
    const seededSwing = (rng() - 0.5) * SWING_RANGE;

    const pEffort = effortMultiplier(state.player.stamina) * mobilityMultiplier(state.player.legDamage);
    const oEffort = effortMultiplier(state.opponent.stamina) * mobilityMultiplier(state.opponent.legDamage);

    const playerAttackScore =
      state.player.statLine[PHASE_OFFENSE['strike']] * pEffort * sigMove.atkMult * plan.atkMult -
      state.opponent.statLine[PHASE_DEFENSE['strike']] * oEffort * defMult(oppMove, 'strike');
    const oPhase = movePhase(oppMove);
    // FIX A: defMult(_, 'wrestle') always returns 1.0 — apply sigMove.defMult only for strike counters.
    const sigCounterDefMult = oPhase === 'wrestle' ? 1.0 : sigMove.defMult;
    const oppAttackScore =
      state.opponent.statLine[PHASE_OFFENSE[oPhase]] * oEffort * atkMult(oppMove) -
      state.player.statLine[PHASE_DEFENSE[oPhase]] * pEffort * sigCounterDefMult * plan.defMult;

    const IQ = (state.player.statLine.fightIQ - state.opponent.statLine.fightIQ) * IQ_FACTOR;
    const dominance = playerAttackScore - oppAttackScore + IQ + seededSwing;

    const margin = Math.floor(Math.abs(dominance) / 10);
    const winner: 'player' | 'opponent' | 'draw' = dominance > 0 ? 'player' : dominance < 0 ? 'opponent' : 'draw';

    const p: Fighter2 = { ...state.player };
    const o: FightState['opponent'] = { ...state.opponent };

    const oCost = oppMove.kind === 'strike' ? STRIKES[oppMove.strike].staminaCost
      : oppMove.kind === 'takedown' ? TAKEDOWN_PROFILES[oppMove.takedownType].cost
      : 0;

    // FIX A: opponent takedown during signature → route through the SAME ground handler as the normal
    // path (submission window or GnP + crossRoundBoundary). Never apply generic head damage for a takedown.
    if (dominance < 0 && oppMove.kind === 'takedown') {
      const oppScoreAfter = state.opponent.roundScore + 1 + margin;
      const pBase: Fighter2 = p; // signature staminaCost = 0; player stamina unchanged.
      const oBase: Opp = { ...o, stamina: clampStamina(o.stamina - oCost), roundScore: oppScoreAfter };
      const tdLogEntry: RoundLogEntry = { round: state.round, exchange: state.exchange, playerIntent: playerMove, opponentIntent: oppMove, winner, dominance };

      const oppPlan = chooseGroundPlan(state.player.statLine);
      if (oppPlan === 'submission') {
        const report = makeReport(state.round, 'opponent', dominance, playerMove, oppMove, state, pBase, oBase);
        const beat = buildResolvedBeat({ round: state.round, exchange: state.exchange, winner: 'opponent', dominance,
          moveClass: 'takedown', moveId: oppMove.takedownType, target: null,
          outcome: 'landed',
          deltas: makeBeatDeltas(state, pBase, oBase), status: makeBeatStatus(state, pBase, oBase),
          signatureId: null, isFinish: false, finishMethod: null });
        return {
          ...state, phase: 'finish-window',
          window: { side: 'opponent', method: 'submission', stepsLeft: INITIAL_STEPS },
          gamePlan: null, lastReport: report,
          player: pBase, opponent: oBase,
          log: [...state.log, tdLogEntry], signatureCharge: 0,
          beats: [...state.beats, beat],
        };
      }

      const gpDmg = groundAndPoundDamage(state.opponent.statLine, state.player.statLine);
      const preHead = state.player.headDamage;
      const postHead = preHead + gpDmg;
      const rocked = ROCKED_HEAD_DMG(state.player.statLine.chin);
      const pGnp: Fighter2 = { ...pBase, headDamage: postHead };
      const gnpReport = makeReport(state.round, 'opponent', dominance, playerMove, oppMove, state, pGnp, oBase);

      if (preHead < rocked && postHead >= rocked) {
        const beat = buildResolvedBeat({ round: state.round, exchange: state.exchange, winner: 'opponent', dominance,
          moveClass: 'takedown', moveId: oppMove.takedownType, target: 'head',
          outcome: 'landed',
          deltas: makeBeatDeltas(state, pGnp, oBase), status: makeBeatStatus(state, pGnp, oBase),
          signatureId: null, isFinish: false, finishMethod: null });
        return {
          ...state, phase: 'finish-window',
          window: { side: 'opponent', method: 'KO', stepsLeft: INITIAL_STEPS },
          gamePlan: null, lastReport: gnpReport,
          player: pGnp, opponent: oBase,
          log: [...state.log, tdLogEntry], signatureCharge: 0,
          beats: [...state.beats, beat],
        };
      }

      const beat = buildResolvedBeat({ round: state.round, exchange: state.exchange, winner: 'opponent', dominance,
        moveClass: 'takedown', moveId: oppMove.takedownType, target: 'head',
        outcome: 'landed',
        deltas: makeBeatDeltas(state, pGnp, oBase), status: makeBeatStatus(state, pGnp, oBase),
        signatureId: null, isFinish: false, finishMethod: null });
      return { ...crossRoundBoundary({ ...state, beats: [...state.beats, beat] }, pGnp, oBase, plan.staminaDelta, [...state.log, tdLogEntry]), lastReport: gnpReport, signatureCharge: 0 };
    }

    if (dominance > 0) {
      const dmg = Math.round(Math.abs(dominance) * DMG_FACTOR * sigMove.power);
      o.headDamage += dmg; // signature always targets head
      p.roundScore += 1 + margin;
    } else if (dominance < 0) {
      // Strike counter (oppMove.kind === 'strike' guaranteed; takedown was handled above)
      const cPower = oppMove.kind === 'strike' ? STRIKES[oppMove.strike].power : 1;
      const cTarget = oppMove.kind === 'strike' ? STRIKES[oppMove.strike].target : 'head';
      const cDmg = Math.round(Math.abs(dominance) * DMG_FACTOR * cPower);
      // FIX A: clamp player stamina after body counter (was missing, could go negative)
      if (cTarget === 'body') { p.bodyDamage += cDmg; p.stamina = clampStamina(p.stamina - Math.round(cDmg * BODY_TO_STAMINA)); }
      else if (cTarget === 'legs') { p.legDamage += cDmg; }
      else { p.headDamage += cDmg; }
      o.roundScore += 1 + margin;
    }

    o.stamina = clampStamina(o.stamina - oCost);

    // Charge resets to 0 regardless of outcome — it's spent.
    const signatureCharge = 0;

    const logEntry: RoundLogEntry = { round: state.round, exchange: state.exchange, playerIntent: playerMove, opponentIntent: oppMove, winner, dominance };
    const report = buildRoundReport({
      round: state.round,
      winner,
      dominance,
      playerIntent: playerMove,
      opponentIntent: oppMove,
      playerHeadDelta: Math.max(0, p.headDamage - state.player.headDamage),
      playerBodyDelta: Math.max(0, p.bodyDamage - state.player.bodyDamage),
      opponentHeadDelta: Math.max(0, o.headDamage - state.opponent.headDamage),
      opponentBodyDelta: Math.max(0, o.bodyDamage - state.opponent.bodyDamage),
      playerBecameRocked:
        state.player.headDamage < ROCKED_HEAD_DMG(state.player.statLine.chin) &&
        p.headDamage >= ROCKED_HEAD_DMG(state.player.statLine.chin),
      opponentBecameRocked:
        state.opponent.headDamage < ROCKED_HEAD_DMG(state.opponent.statLine.chin) &&
        o.headDamage >= ROCKED_HEAD_DMG(state.opponent.statLine.chin),
      playerGassed: isGassed(p.stamina),
      opponentGassed: isGassed(o.stamina),
      signatureFlavor: sigMove.flavor,
    });

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

    // Beat construction for normal signature exchange (player wins or opponent strike counter).
    const sigCounterTarget = dominance < 0 && oppMove.kind === 'strike' ? STRIKES[oppMove.strike].target : null;
    const sigBeatMoveClass: BeatMoveClass = dominance > 0 ? 'signature' : 'strike';
    const sigBeatOutcome: BeatOutcome = dominance === 0 ? 'evaded' : 'landed';
    const sigBeatMoveId: string | null = dominance > 0 ? state.signatureId : (dominance < 0 && oppMove.kind === 'strike' ? oppMove.strike : null);
    const sigBeatTarget = dominance > 0 ? 'head' : sigCounterTarget;
    const sigBeat = buildResolvedBeat({ round: state.round, exchange: state.exchange, winner, dominance,
      moveClass: sigBeatMoveClass, moveId: sigBeatMoveId, target: sigBeatTarget,
      outcome: sigBeatOutcome,
      deltas: makeBeatDeltas(state, p, o), status: makeBeatStatus(state, p, o),
      signatureId: winner === 'player' ? state.signatureId : null, isFinish: false, finishMethod: null });

    const base = { ...state, player: p, opponent: o, log: [...state.log, logEntry], lastReport: report, signatureCharge, beats: [...state.beats, sigBeat] };
    if (finishWindow) return { ...base, phase: 'finish-window', window: finishWindow, gamePlan: null };
    if (state.exchange < EXCHANGES_PER_ROUND) return { ...base, exchange: state.exchange + 1 };
    return { ...crossRoundBoundary({ ...state, beats: [...state.beats, sigBeat] }, p, o, plan.staminaDelta, [...state.log, logEntry]), lastReport: report, signatureCharge };
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

  const IQ = (state.player.statLine.fightIQ - state.opponent.statLine.fightIQ) * IQ_FACTOR;
  const dominance = playerAttackScore - oppAttackScore + IQ + seededSwing;

  // For player takedowns, the landing check uses ONLY the wrestling dimension
  // (player.takedowns × atkMult − opp.TDD + IQ + swing), decoupled from the opponent's
  // counter-strike score. This ensures early-fight shots into weak-TDD opponents
  // always land while late-fight shots into elite-TDD opponents get genuinely contested.
  // When a shot fails (takedownCheck ≤ 0), full `dominance` drives the counter-damage.
  const takedownCheck = playerMove.kind === 'takedown'
    ? playerAttackScore + IQ + seededSwing
    : null;

  const pCost = playerMove.kind === 'strike' ? STRIKES[playerMove.strike].staminaCost
    : playerMove.kind === 'takedown' ? TAKEDOWN_PROFILES[playerMove.takedownType].cost
    : 0; // signature: no stamina cost (it's earned)
  const oCost = oppMove.kind === 'strike' ? STRIKES[oppMove.strike].staminaCost
    : oppMove.kind === 'takedown' ? TAKEDOWN_PROFILES[oppMove.takedownType].cost
    : 0; // opponent never throws signature, but TypeScript needs exhaustiveness
  const margin = Math.floor(Math.abs(dominance) / 10);
  const winner: 'player' | 'opponent' | 'draw' = dominance > 0 ? 'player' : dominance < 0 ? 'opponent' : 'draw';

  // ── M17: Charge accrual — computed per-branch from the branch's actual winner ──
  // FIX B: the up-front winner (from raw dominance) is wrong for takedowns where takedownCheck
  // diverges from dominance. Charge is now computed inside each branch.

  const logEntry: RoundLogEntry = {
    round: state.round,
    exchange: state.exchange,
    playerIntent: playerMove,
    opponentIntent: oppMove,
    winner,
    dominance,
  };

  // ── Player takedown lands (takedownCheck > 0) → enter the ground phase ──
  if ((takedownCheck ?? dominance) > 0 && playerMove.kind === 'takedown') {
    const profile = TAKEDOWN_PROFILES[playerMove.takedownType];
    const tdMargin = Math.floor(Math.abs(takedownCheck!) / 10);
    const p: Fighter2 = { ...state.player, stamina: clampStamina(state.player.stamina - pCost), roundScore: state.player.roundScore + 1 + tdMargin };
    const o: FightState['opponent'] = { ...state.opponent, stamina: clampStamina(state.opponent.stamina - oCost) };
    const tdLogEntry: RoundLogEntry = { round: state.round, exchange: state.exchange, playerIntent: playerMove, opponentIntent: oppMove, winner: 'player', dominance: takedownCheck! };
    const report = makeReport(state.round, 'player', takedownCheck!, playerMove, oppMove, state, p, o);
    const nextExchange = state.exchange + 1;
    const logNow = [...state.log, tdLogEntry];
    // FIX B: charge uses the actual takedownCheck (the authoritative winner for this branch), not raw dominance.
    const tdChargeGain = Math.min(100 - state.signatureCharge, Math.round(SIGNATURE_CHARGE_GAIN + SIGNATURE_CHARGE_DOM * takedownCheck!));
    const tdSignatureCharge = state.signatureCharge + tdChargeGain;
    const tdBeat = buildResolvedBeat({ round: state.round, exchange: state.exchange, winner: 'player', dominance: takedownCheck!,
      moveClass: 'takedown', moveId: playerMove.takedownType, target: null,
      outcome: 'landed',
      deltas: makeBeatDeltas(state, p, o), status: makeBeatStatus(state, p, o),
      signatureId: null, isFinish: false, finishMethod: null });
    // The shot consumed this beat. If it was the last beat, the takedown still SCORES
    // but there are no ground beats this round → cross the round boundary (recovery applied).
    if (nextExchange > EXCHANGES_PER_ROUND) {
      return { ...crossRoundBoundary({ ...state, beats: [...state.beats, tdBeat] }, p, o, plan.staminaDelta, logNow), lastReport: report, signatureCharge: tdSignatureCharge };
    }
    // Otherwise enter the ground phase at the landed position; ground beats share the beat budget.
    return {
      ...state,
      phase: 'ground',
      exchange: nextExchange,
      ground: { position: profile.landsAt },
      window: null,
      gamePlan: state.gamePlan,
      lastReport: report,
      player: p,
      opponent: o,
      log: logNow,
      signatureCharge: tdSignatureCharge,
      beats: [...state.beats, tdBeat],
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
      const beat = buildResolvedBeat({ round: state.round, exchange: state.exchange, winner: 'opponent', dominance,
        moveClass: 'takedown', moveId: oppMove.takedownType, target: null,
        outcome: 'landed',
        deltas: makeBeatDeltas(state, pBase, oBase), status: makeBeatStatus(state, pBase, oBase),
        signatureId: null, isFinish: false, finishMethod: null });
      return {
        ...state,
        phase: 'finish-window',
        window: { side: 'opponent', method: 'submission', stepsLeft: INITIAL_STEPS },
        gamePlan: null,
        lastReport: report,
        player: pBase,
        opponent: oBase,
        log: [...state.log, logEntry],
        signatureCharge: state.signatureCharge, // FIX B: opponent wins → no charge
        beats: [...state.beats, beat],
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
      const beat = buildResolvedBeat({ round: state.round, exchange: state.exchange, winner: 'opponent', dominance,
        moveClass: 'takedown', moveId: oppMove.takedownType, target: 'head',
        outcome: 'landed',
        deltas: makeBeatDeltas(state, pGnp, oBase), status: makeBeatStatus(state, pGnp, oBase),
        signatureId: null, isFinish: false, finishMethod: null });
      return {
        ...state,
        phase: 'finish-window',
        window: { side: 'opponent', method: 'KO', stepsLeft: INITIAL_STEPS },
        gamePlan: null,
        lastReport: report,
        player: pGnp,
        opponent: oBase,
        log: [...state.log, logEntry],
        signatureCharge: state.signatureCharge, // FIX B: opponent wins → no charge
        beats: [...state.beats, beat],
      };
    }

    // No rock → partial damage; advance the round (round-boundary stamina applied).
    const beat = buildResolvedBeat({ round: state.round, exchange: state.exchange, winner: 'opponent', dominance,
      moveClass: 'takedown', moveId: oppMove.takedownType, target: 'head',
      outcome: 'landed',
      deltas: makeBeatDeltas(state, pGnp, oBase), status: makeBeatStatus(state, pGnp, oBase),
      signatureId: null, isFinish: false, finishMethod: null });
    return { ...crossRoundBoundary({ ...state, beats: [...state.beats, beat] }, pGnp, oBase, plan.staminaDelta, [...state.log, logEntry]), lastReport: report, signatureCharge: state.signatureCharge }; // FIX B
  }

  // ── Player takedown stuffed (takedownCheck ≤ 0): failed shot — never enters ground, never deals strike damage ──
  if (takedownCheck !== null) {
    // At this point: playerMove.kind === 'takedown' && takedownCheck <= 0
    const p: Fighter2 = { ...state.player, stamina: clampStamina(state.player.stamina - pCost) };
    const o: Opp = { ...state.opponent, stamina: clampStamina(state.opponent.stamina - oCost) };

    if (dominance < 0) {
      // Opponent counter wins the beat: oppMove drives damage (same logic as strike branch loser path).
      const cPower = oppMove.kind === 'strike' ? STRIKES[oppMove.strike].power : 1;
      const cTarget = oppMove.kind === 'strike' ? STRIKES[oppMove.strike].target : 'head';
      const cDmg = Math.round(Math.abs(dominance) * DMG_FACTOR * cPower);
      if (cTarget === 'body') { p.bodyDamage += cDmg; p.stamina = clampStamina(p.stamina - Math.round(cDmg * BODY_TO_STAMINA)); }
      else if (cTarget === 'legs') { p.legDamage += cDmg; }
      else { p.headDamage += cDmg; }
      o.roundScore += 1 + margin;
    }
    // dominance >= 0: whiff — stamina cost paid above, no damage applied.
    // Whiff is a no-op: nobody scored, report draw at dominance 0 (not a player win).
    // Counter (dom < 0) already handled above with actual dominance.
    const stuffedWinner: 'player' | 'opponent' | 'draw' = dominance < 0 ? 'opponent' : 'draw';
    const resolvedDominance = dominance < 0 ? dominance : 0;
    const stuffedLogEntry: RoundLogEntry = { round: state.round, exchange: state.exchange, playerIntent: playerMove, opponentIntent: oppMove, winner: stuffedWinner, dominance: resolvedDominance };
    const report = makeReport(state.round, stuffedWinner, resolvedDominance, playerMove, oppMove, state, p, o);
    const logNow = [...state.log, stuffedLogEntry];
    const stuffedMoveId = dominance < 0 && oppMove.kind === 'strike' ? oppMove.strike : null;
    const stuffedTarget = dominance < 0 && oppMove.kind === 'strike' ? STRIKES[oppMove.strike].target : null;
    const stuffedBeatOutcome: BeatOutcome = dominance < 0 ? 'landed' : 'evaded';
    const stuffedBeat = buildResolvedBeat({ round: state.round, exchange: state.exchange, winner: stuffedWinner, dominance: resolvedDominance,
      moveClass: 'takedown', moveId: stuffedMoveId, target: stuffedTarget,
      outcome: stuffedBeatOutcome,
      deltas: makeBeatDeltas(state, p, o), status: makeBeatStatus(state, p, o),
      signatureId: null, isFinish: false, finishMethod: null });

    // Finish detection only when opponent counter landed (dom < 0 has player taking damage).
    if (dominance < 0) {
      const fw = detectWindow({
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
      if (fw) {
        // FIX B: stuffed shot → no charge regardless of raw dominance direction
        return { ...state, player: p, opponent: o, log: logNow, lastReport: report, phase: 'finish-window', window: fw, gamePlan: null, signatureCharge: state.signatureCharge, beats: [...state.beats, stuffedBeat] };
      }
    }

    if (state.exchange < EXCHANGES_PER_ROUND) {
      // FIX B: stuffed shot → no charge regardless of raw dominance direction
      return { ...state, player: p, opponent: o, log: logNow, lastReport: report, exchange: state.exchange + 1, signatureCharge: state.signatureCharge, beats: [...state.beats, stuffedBeat] };
    }
    return { ...crossRoundBoundary({ ...state, beats: [...state.beats, stuffedBeat] }, p, o, plan.staminaDelta, logNow), lastReport: report, signatureCharge: state.signatureCharge }; // FIX B
  }

  // ── Strike exchange (playerMove.kind === 'strike' is guaranteed here) ──
  const winnerMove = dominance > 0 ? playerMove : oppMove;
  const power = winnerMove.kind === 'strike' ? STRIKES[winnerMove.strike].power : 1;
  const target = winnerMove.kind === 'strike' ? STRIKES[winnerMove.strike].target : 'head';
  const dmg = Math.round(Math.abs(dominance) * DMG_FACTOR * power);

  const p: Fighter2 = { ...state.player };
  const o: Opp = { ...state.opponent };

  if (dominance > 0) {
    // work-body corner plan (forceBodyTarget) redirects the player's landed damage to the body
    // regardless of the thrown strike's own target — trade a head-KO now for gas erosion later.
    if (plan.forceBodyTarget || target === 'body') { o.bodyDamage += dmg; o.stamina -= Math.round(dmg * BODY_TO_STAMINA); }
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

  // FIX B: charge from strike win — use actual dominance for this branch (correct here since no takedownCheck divergence).
  const chargeGain = dominance > 0
    ? Math.min(100 - state.signatureCharge, Math.round(SIGNATURE_CHARGE_GAIN + SIGNATURE_CHARGE_DOM * dominance))
    : 0;
  const newSignatureCharge = state.signatureCharge + chargeGain;

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

  const strikeBeatMoveId: string | null = winner !== 'draw' ? (winnerMove.kind === 'strike' ? winnerMove.strike : null) : null;
  const strikeBeatTarget = winner !== 'draw' ? target : null;
  const strikeBeatOutcome: BeatOutcome = dominance === 0 ? 'evaded' : 'landed';
  const strikeBeat = buildResolvedBeat({ round: state.round, exchange: state.exchange, winner, dominance,
    moveClass: 'strike', moveId: strikeBeatMoveId, target: strikeBeatTarget,
    outcome: strikeBeatOutcome,
    deltas: makeBeatDeltas(state, p, o), status: makeBeatStatus(state, p, o),
    signatureId: null, isFinish: false, finishMethod: null });

  const base = { ...state, player: p, opponent: o, log: [...state.log, logEntry], lastReport: report, signatureCharge: newSignatureCharge, beats: [...state.beats, strikeBeat] };
  if (finishWindow) {
    return { ...base, phase: 'finish-window', window: finishWindow, gamePlan: null };
  }

  // Not the last beat → advance the exchange, same round, no recovery.
  if (state.exchange < EXCHANGES_PER_ROUND) {
    return { ...base, exchange: state.exchange + 1 };
  }

  // Last beat of the round → cross the round boundary.
  return { ...crossRoundBoundary({ ...state, beats: [...state.beats, strikeBeat] }, p, o, plan.staminaDelta, [...state.log, logEntry]), lastReport: report, signatureCharge: newSignatureCharge };
}
