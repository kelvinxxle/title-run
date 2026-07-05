import type { ExchangeMove } from './intents';
import { STRIKES } from './strikes';

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
