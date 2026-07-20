import type { ExchangeMove } from './intents';
import { STRIKES } from './strikes';
import type { GroundAction, GroundPosition } from './ground';
import { GROUND_POSITION_LABELS, POSITION_SUBMISSION, SUBMISSION_LABELS } from './ground';

export interface RoundReportInput {
  round: number;
  winner: 'player' | 'opponent' | 'draw';
  dominance: number;
  playerIntent: ExchangeMove;
  opponentIntent: ExchangeMove;
  playerHeadDelta: number;
  playerBodyDelta: number;
  opponentHeadDelta: number;
  opponentBodyDelta: number;
  playerBecameRocked: boolean;
  opponentBecameRocked: boolean;
  playerGassed: boolean;
  opponentGassed: boolean;
}

export interface RoundReport {
  round: number;
  headline: string;
  detail: string;
  winner: 'player' | 'opponent' | 'draw';
  playerHeadDelta: number;
  playerBodyDelta: number;
  opponentHeadDelta: number;
  opponentBodyDelta: number;
}

export function buildRoundReport(input: RoundReportInput): RoundReport {
  const {
    round, winner, dominance,
    playerIntent, opponentIntent,
    playerHeadDelta, playerBodyDelta,
    opponentHeadDelta, opponentBodyDelta,
    playerBecameRocked, opponentBecameRocked,
    playerGassed, opponentGassed,
  } = input;

  let headline: string;
  if (opponentBecameRocked) {
    headline = "You've got him HURT!";
  } else if (playerBecameRocked) {
    headline = "You're ROCKED — hang on!";
  } else if (
    winner === 'player'
    && playerIntent.kind === 'strike' && STRIKES[playerIntent.strike].speed >= 0.7
    && opponentIntent.kind === 'strike' && STRIKES[opponentIntent.strike].koWeight >= 1.0
  ) {
    headline = 'Perfect timing — you read him cold.';
  } else if (
    winner === 'opponent'
    && opponentIntent.kind === 'strike' && STRIKES[opponentIntent.strike].speed >= 0.7
    && playerIntent.kind === 'strike' && STRIKES[playerIntent.strike].koWeight >= 1.0
  ) {
    headline = 'He timed you cold.';
  } else if (winner === 'player' && dominance >= 15) {
    headline = 'You lit him up.';
  } else if (winner === 'player') {
    headline = 'You took the round.';
  } else if (winner === 'opponent' && dominance <= -15) {
    headline = 'He walked you down.';
  } else if (winner === 'opponent') {
    headline = 'He out-worked you.';
  } else {
    headline = 'Even round — nobody blinked.';
  }

  let detail: string;
  if (opponentBodyDelta >= 8) {
    detail = 'Body work is adding up — his gas will pay for it.';
  } else if (opponentGassed) {
    detail = "He's sucking wind.";
  } else if (playerGassed) {
    detail = "You're sucking wind.";
  } else if (
    winner === 'player'
    && playerIntent.kind === 'strike'
    && STRIKES[playerIntent.strike].target === 'legs'
  ) {
    detail = "You're chopping his base down.";
  } else if (
    winner === 'opponent'
    && opponentIntent.kind === 'strike'
    && STRIKES[opponentIntent.strike].target === 'legs'
  ) {
    detail = "He's chopping your base down.";
  } else {
    detail = 'You picked him apart at range.';
  }

  return {
    round,
    headline,
    detail,
    winner,
    playerHeadDelta,
    playerBodyDelta,
    opponentHeadDelta,
    opponentBodyDelta,
  };
}

export interface GroundReportInput {
  round: number;
  action: GroundAction;
  position: GroundPosition;   // position AFTER the action resolved
  success: boolean;
  opponentHeadDelta: number;
  escaped: boolean;
  submitted: boolean;
}

export function buildGroundReport(input: GroundReportInput): RoundReport {
  const posLabel = GROUND_POSITION_LABELS[input.position];
  let headline: string;
  let detail: string;

  if (input.submitted) {
    const sub = POSITION_SUBMISSION[input.position];
    headline = sub ? `Tap! ${SUBMISSION_LABELS[sub]} from ${posLabel}.` : `Submission from ${posLabel}.`;
    detail = 'The opponent taps — it is over.';
  } else if (input.action === 'submission') {
    headline = `Submission attempt from ${posLabel}.`;
    detail = 'He defends and works free of the hold.';
  } else if (input.action === 'advance') {
    headline = input.success ? `Advanced to ${posLabel}.` : `Stuffed advancing from ${posLabel}.`;
    detail = input.success ? 'Better position, more control.' : 'He frames and denies the pass.';
  } else {
    headline = `Ground & pound from ${posLabel}.`;
    detail = input.opponentHeadDelta > 0 ? `Heavy shots land — ${input.opponentHeadDelta} damage.` : 'He covers up.';
  }
  if (input.escaped) detail += ' The opponent scrambles up and escapes to the feet.';

  return {
    round: input.round,
    headline,
    detail,
    winner: 'player',
    playerHeadDelta: 0,
    playerBodyDelta: 0,
    opponentHeadDelta: input.opponentHeadDelta,
    opponentBodyDelta: 0,
  };
}
