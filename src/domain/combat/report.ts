import type { RoundIntent } from './intents';

export interface RoundReportInput {
  round: number;
  winner: 'player' | 'opponent' | 'draw';
  dominance: number;
  playerIntent: RoundIntent;
  opponentIntent: RoundIntent;
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
    && playerIntent.kind === 'strike' && playerIntent.tactic === 'counter'
    && opponentIntent.kind === 'strike' && opponentIntent.tactic === 'pressure'
  ) {
    headline = 'Perfect counter — you read him cold.';
  } else if (
    winner === 'opponent'
    && opponentIntent.kind === 'strike' && opponentIntent.tactic === 'counter'
    && playerIntent.kind === 'strike' && playerIntent.tactic === 'pressure'
  ) {
    headline = 'He read you cold.';
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
