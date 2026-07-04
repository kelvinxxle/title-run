import type { FightState, RoundLogEntry } from './fightState';
import { opponentIntent } from './fightState';
import { scoreFight } from './judges';
import type { RoundIntent, StrikeTactic, Phase } from './intents';
import { intentPhase } from './intents';
import { PHASE_OFFENSE, PHASE_DEFENSE } from './stats';
import { staminaCost, recovery, effortMultiplier, STAMINA_MAX, isGassed } from './stamina';
import { createRng } from '../rng';
import { detectWindow, INITIAL_STEPS, chooseGroundPlan, groundAndPoundDamage, ROCKED_HEAD_DMG } from './finish';
import { gamePlanEffect } from './gameplan';
import { buildRoundReport } from './report';
import type { RoundReport } from './report';

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
// Wrestle constants. Set above the spec's baselines (1.0 / 0.7) in Task 1 so
// exploiting a takedown-defense hole is a real edge. Task 5 evaluated retuning
// these toward 1.0 / 0.7 now that wrestle resolves through the ground game, but
// KEPT them at 1.1 / 0.9: all four strengthened balance bands stay green with them
// and the ground window already governs wrestle outcomes, so no retune was needed.
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

function buildReport(
  round: number,
  prePH: number, prePB: number, preOH: number, preOB: number,
  postPH: number, postPB: number, postOH: number, postOB: number,
  postPStamina: number, postOStamina: number,
  pChin: number, oChin: number,
  logEntry: RoundLogEntry,
): RoundReport {
  const playerBecameRocked = prePH < ROCKED_HEAD_DMG(pChin) && postPH >= ROCKED_HEAD_DMG(pChin);
  const opponentBecameRocked = preOH < ROCKED_HEAD_DMG(oChin) && postOH >= ROCKED_HEAD_DMG(oChin);
  return buildRoundReport({
    round,
    winner: logEntry.winner,
    dominance: logEntry.dominance,
    playerIntent: logEntry.playerIntent,
    opponentIntent: logEntry.opponentIntent,
    playerHeadDelta: Math.max(0, postPH - prePH),
    playerBodyDelta: Math.max(0, postPB - prePB),
    opponentHeadDelta: Math.max(0, postOH - preOH),
    opponentBodyDelta: Math.max(0, postOB - preOB),
    playerBecameRocked,
    opponentBecameRocked,
    playerGassed: isGassed(postPStamina),
    opponentGassed: isGassed(postOStamina),
  });
}

export function resolveRound(state: FightState, playerIntent: RoundIntent): FightState {
  if (state.phase !== 'in-round') {
    throw new Error(`resolveRound requires state.phase === "in-round" (got "${state.phase}")`);
  }
  const rng = createRng(`${state.seed}#f${state.fightNumber}#r${state.round}`);
  const oppIntent = opponentIntent(state);
  const planEffect = gamePlanEffect(state.gamePlan);

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
    state.player.statLine[PHASE_OFFENSE[pPhase]] * playerEffort * atkMult(playerIntent) * planEffect.atkMult -
    state.opponent.statLine[PHASE_DEFENSE[pPhase]] * oppEffort * defMult(oppIntent, pPhase) +
    counterBonus(playerIntent, oppIntent);

  // Opponent attacks at oPhase; player defends there.
  const oppAttackScore =
    state.opponent.statLine[PHASE_OFFENSE[oPhase]] * oppEffort * atkMult(oppIntent) -
    state.player.statLine[PHASE_DEFENSE[oPhase]] * playerEffort * defMult(playerIntent, oPhase) * planEffect.defMult +
    counterBonus(oppIntent, playerIntent);

  const dominance =
    playerAttackScore - oppAttackScore +
    (state.player.statLine.fightIQ - state.opponent.statLine.fightIQ) * IQ_FACTOR +
    seededSwing;

  // ── Ground window (Task 2) ──────────────────────────────────────────────────
  // A winning PLAYER wrestle opens a ground window instead of dealing exchange
  // damage. The player then chooses Ground & Pound or Submission via groundStep.
  // This is an early branch: no exchange damage, round is NOT advanced. A winning
  // OPPONENT wrestle is handled by the opponent-ground branch below (Task 3): a
  // submission-read or a rocking Ground & Pound opens an opponent-side finish window,
  // while a non-rocking Ground & Pound applies partial head damage and advances the round.
  if (dominance > 0 && playerIntent.kind === 'wrestle') {
    const groundMargin = Math.floor(Math.abs(dominance) / 10);
    const groundLog: RoundLogEntry = {
      round: state.round,
      playerIntent,
      opponentIntent: oppIntent,
      winner: 'player',
      dominance,
    };
    const playerStaminaAfter = clampStamina(
      state.player.stamina - staminaCost(playerIntent)
        + recovery(state.player.statLine) - bodyRecoveryPenalty(state.player.bodyDamage)
        + planEffect.staminaDelta
    );
    const oppStaminaAfter = clampStamina(
      state.opponent.stamina - staminaCost(oppIntent)
        + recovery(state.opponent.statLine) - bodyRecoveryPenalty(state.opponent.bodyDamage)
    );
    const report = buildReport(
      state.round,
      state.player.headDamage,
      state.player.bodyDamage,
      state.opponent.headDamage,
      state.opponent.bodyDamage,
      state.player.headDamage,
      state.player.bodyDamage,
      state.opponent.headDamage,
      state.opponent.bodyDamage,
      playerStaminaAfter,
      oppStaminaAfter,
      state.player.statLine.chin,
      state.opponent.statLine.chin,
      groundLog,
    );
    return {
      ...state,
      // round NOT advanced — the ground sequence resolves this moment
      phase: 'ground-window',
      window: { side: 'player', method: 'ground', stepsLeft: INITIAL_STEPS },
      gamePlan: null,
      lastReport: report,
      player: {
        ...state.player,
        // no exchange damage on the ground-window open
        stamina: playerStaminaAfter,
        roundScore: state.player.roundScore + 1 + groundMargin,
      },
      opponent: {
        ...state.opponent,
        stamina: oppStaminaAfter,
      },
      log: [...state.log, groundLog],
    };
  }

  // ── Opponent takedown → ground threat (Task 3) ──────────────────────────────
  // A winning OPPONENT wrestle takes the player down; the opponent AI then resolves
  // a ground action (submission read vs ground-and-pound). Dangerous outcomes open
  // an OPPONENT-side finish window so the player keeps defensive agency — they
  // defend via the existing finishStep/FinishSequencePanel. Mirrors the player
  // ground-window branch above: apply this round's stamina for both sides + the
  // opponent's roundScore + append the log. When a window opens the round is NOT
  // advanced; a non-rocking GnP advances the round like a normal loss. No extra RNG
  // is drawn here (GnP is deterministic; a submission threat just opens a window).
  if (dominance < 0 && oppIntent.kind === 'wrestle') {
    const groundMargin = Math.floor(Math.abs(dominance) / 10);
    const groundLog: RoundLogEntry = {
      round: state.round,
      playerIntent,
      opponentIntent: oppIntent,
      winner: 'opponent',
      dominance,
    };
    const playerStaminaAfter = clampStamina(
      state.player.stamina - staminaCost(playerIntent)
        + recovery(state.player.statLine) - bodyRecoveryPenalty(state.player.bodyDamage)
        + planEffect.staminaDelta
    );
    const oppStaminaAfter = clampStamina(
      state.opponent.stamina - staminaCost(oppIntent)
        + recovery(state.opponent.statLine) - bodyRecoveryPenalty(state.opponent.bodyDamage)
    );
    const oppScoreAfter = state.opponent.roundScore + 1 + groundMargin;

    // AI ground choice: submission only when the player's submission defense is porous.
    const oppPlan = chooseGroundPlan(state.player.statLine);
    const submissionReport = buildReport(
      state.round,
      state.player.headDamage,
      state.player.bodyDamage,
      state.opponent.headDamage,
      state.opponent.bodyDamage,
      state.player.headDamage,
      state.player.bodyDamage,
      state.opponent.headDamage,
      state.opponent.bodyDamage,
      playerStaminaAfter,
      oppStaminaAfter,
      state.player.statLine.chin,
      state.opponent.statLine.chin,
      groundLog,
    );

    if (oppPlan === 'submission') {
      // The read is dangerous by definition — open a defensible submission window.
      // No head damage; the player DEFENDS via finishStep (opponent must not auto-tap).
      return {
        ...state,
        phase: 'finish-window',
        window: { side: 'opponent', method: 'submission', stepsLeft: INITIAL_STEPS },
        gamePlan: null,
        lastReport: submissionReport,
        player: { ...state.player, stamina: playerStaminaAfter },
        opponent: { ...state.opponent, stamina: oppStaminaAfter, roundScore: oppScoreAfter },
        log: [...state.log, groundLog],
      };
    }

    // ground-and-pound: deterministic damage against the player.
    const gpDmg = groundAndPoundDamage(state.opponent.statLine, state.player.statLine);
    const preHead = state.player.headDamage;
    const postHead = preHead + gpDmg;
    const rocked = ROCKED_HEAD_DMG(state.player.statLine.chin);

    const groundedPlayer = { ...state.player, headDamage: postHead, stamina: playerStaminaAfter };
    const groundedOpponent = { ...state.opponent, stamina: oppStaminaAfter, roundScore: oppScoreAfter };
    const groundReport = buildReport(
      state.round,
      state.player.headDamage,
      state.player.bodyDamage,
      state.opponent.headDamage,
      state.opponent.bodyDamage,
      postHead,
      state.player.bodyDamage,
      state.opponent.headDamage,
      state.opponent.bodyDamage,
      playerStaminaAfter,
      oppStaminaAfter,
      state.player.statLine.chin,
      state.opponent.statLine.chin,
      groundLog,
    );

    if (preHead < rocked && postHead >= rocked) {
      // Rock → opponent-side KO finish window. Applied head damage is carried in
      // the returned state; the player defends via finishStep. Round NOT advanced.
      return {
        ...state,
        phase: 'finish-window',
        window: { side: 'opponent', method: 'KO', stepsLeft: INITIAL_STEPS },
        gamePlan: null,
        lastReport: groundReport,
        player: groundedPlayer,
        opponent: groundedOpponent,
        log: [...state.log, groundLog],
      };
    }

    // No rock → partial GnP damage; advance the round (or score on the last round),
    // mirroring the non-finish resolveRound tail.
    const isLastGroundRound = state.round >= state.rounds;
    if (isLastGroundRound) {
      const finalBase: FightState = {
        ...state,
        round: state.round,
        phase: 'finished',
        gamePlan: null,
        lastReport: groundReport,
        player: groundedPlayer,
        opponent: groundedOpponent,
        log: [...state.log, groundLog],
      };
      return { ...finalBase, round: state.round, outcome: scoreFight(finalBase) };
    }
    return {
      ...state,
      round: state.round + 1,
      phase: 'corner',
      outcome: null,
      gamePlan: null,
      lastReport: groundReport,
      player: groundedPlayer,
      opponent: groundedOpponent,
      log: [...state.log, groundLog],
    };
  }

  // Damage to the round loser. Damage type = winner's target if the winner struck,
  // else 'head' (interim: a winning wrestle just deals head damage until Task 2's
  // ground window arrives).
  const dmg = Math.round(Math.abs(dominance) * DMG_FACTOR);
  const effectivePlayerIntent =
    planEffect.forceBodyTarget && playerIntent.kind === 'strike'
      ? { ...playerIntent, target: 'body' as const }
      : playerIntent;
  const prePlayerHead = state.player.headDamage;
  const prePlayerBody = state.player.bodyDamage;
  const preOppHead = state.opponent.headDamage;
  const preOppBody = state.opponent.bodyDamage;
  let playerHead = prePlayerHead;
  let playerBody = prePlayerBody;
  let oppHead = preOppHead;
  let oppBody = preOppBody;

  let playerStamina = state.player.stamina;
  let oppStamina    = state.opponent.stamina;

  if (dominance > 0) {
    // Player wins the exchange — opponent absorbs damage
    if (effectivePlayerIntent.kind === 'strike' && effectivePlayerIntent.target === 'body') {
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
  playerStamina =
    playerStamina - staminaCost(playerIntent)
      + recovery(state.player.statLine) - bodyRecoveryPenalty(state.player.bodyDamage)
      + planEffect.staminaDelta;
  playerStamina = clampStamina(playerStamina);
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
  const report = buildReport(
    state.round,
    prePlayerHead,
    prePlayerBody,
    preOppHead,
    preOppBody,
    playerHead,
    playerBody,
    oppHead,
    oppBody,
    playerStamina,
    oppStamina,
    state.player.statLine.chin,
    state.opponent.statLine.chin,
    logEntry,
  );

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
      gamePlan: null,
      lastReport: report,
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
      gamePlan: null,
      lastReport: report,
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
    phase: 'corner',
    outcome: null,
    gamePlan: null,
    lastReport: report,
    player: resolvedPlayer,
    opponent: resolvedOpponent,
    log: [...state.log, logEntry],
  };
}
