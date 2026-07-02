import type { FightState, FightOutcome } from './fightState';

/**
 * Score a completed fight on the judges' cards.
 * Winner = higher accumulated roundScore; ties broken by fightIQ.
 */
export function scoreFight(state: FightState): FightOutcome {
  const playerScore   = state.player.roundScore;
  const opponentScore = state.opponent.roundScore;

  let winner: 'player' | 'opponent';
  if (playerScore > opponentScore) {
    winner = 'player';
  } else if (opponentScore > playerScore) {
    winner = 'opponent';
  } else {
    // Tie-break: higher fightIQ wins; if equal, player wins
    winner = state.player.statLine.fightIQ >= state.opponent.statLine.fightIQ
      ? 'player'
      : 'opponent';
  }

  return {
    winner,
    method: 'decision',
    round: state.round,
  };
}
