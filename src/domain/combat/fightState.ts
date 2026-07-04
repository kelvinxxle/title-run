import type { StatLine } from './stats';
import { PHASE_OFFENSE } from './stats';
import type { RoundIntent, StrikeTactic } from './intents';
import { startingStamina } from './stamina';
import { isGassed } from './stamina';
import { createRng } from '../rng';

// ── Core types ───────────────────────────────────────────────────────────────

export interface Fighter2 {
  statLine: StatLine;
  headDamage: number;
  bodyDamage: number;
  stamina: number;
  roundScore: number;
}

export type FightPhase = 'in-round' | 'finish-window' | 'ground-window' | 'finished';

export interface FinishWindow {
  side: 'player' | 'opponent';
  method: 'KO' | 'submission' | 'ground';
  stepsLeft: number;
}

export interface FightOutcome {
  winner: 'player' | 'opponent';
  method: 'KO' | 'submission' | 'decision';
  round: number;
}

export interface RoundLogEntry {
  round: number;
  playerIntent: RoundIntent;
  opponentIntent: RoundIntent;
  winner: 'player' | 'opponent' | 'draw';
  dominance: number;
}

export type OpponentLike = {
  id: string;
  name: string;
  archetype: string;
  statLine: StatLine;
};

export interface FightState {
  seed: string;
  fightNumber: number;
  rounds: number;
  round: number;
  phase: FightPhase;
  player: Fighter2;
  opponent: Fighter2 & { name: string; archetype: string };
  window: FinishWindow | null;
  outcome: FightOutcome | null;
  log: RoundLogEntry[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function roundsForFight(fightNumber: number): number {
  return fightNumber >= 5 ? 5 : 3;
}

function makeFighter(statLine: StatLine): Fighter2 {
  return {
    statLine,
    headDamage: 0,
    bodyDamage: 0,
    stamina: startingStamina(statLine),
    roundScore: 0,
  };
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function startFight(args: {
  seed: string;
  fightNumber: number;
  playerStatLine: StatLine;
  opponent: OpponentLike;
}): FightState {
  const { seed, fightNumber, playerStatLine, opponent } = args;
  return {
    seed,
    fightNumber,
    rounds: roundsForFight(fightNumber),
    round: 1,
    phase: 'in-round',
    player: makeFighter(playerStatLine),
    opponent: { ...makeFighter(opponent.statLine), name: opponent.name, archetype: opponent.archetype },
    window: null,
    outcome: null,
    log: [],
  };
}

// ── Opponent AI ───────────────────────────────────────────────────────────────

export function opponentIntent(state: FightState): RoundIntent {
  const rng = createRng(`${state.seed}#f${state.fightNumber}#ai${state.round}`);

  // Draw all RNG values upfront for uniform consumption regardless of branch.
  const roll = rng();
  const tacticIdx = rng();

  // Choose kind by the opponent's better edge over the player's matching defense.
  const strikeEdge = state.opponent.statLine[PHASE_OFFENSE.strike] - state.player.statLine.strikingDef;
  const wrestleEdge = state.opponent.statLine[PHASE_OFFENSE.wrestle] - state.player.statLine.takedownDef;

  if (wrestleEdge > strikeEdge) {
    return { kind: 'wrestle' };
  }

  // Striking: target body when the player is gassed, else head.
  const target = isGassed(state.player.stamina) ? 'body' : 'head';

  // Choose tactic biased by fightNumber (higher → more aggressive).
  // fightNumber 1-4: favour pickApart/counter; 5+: favour pressure.
  // Fallback ordering preserves the pre-redesign distribution (technical ≡ pickApart).
  const TACTIC_FALLBACK: readonly StrikeTactic[] = ['pressure', 'pickApart', 'counter'];
  const aggression = Math.min(1, (state.fightNumber - 1) / 4); // 0..1
  let tactic: StrikeTactic;
  if (roll < aggression * 0.6) {
    tactic = 'pressure';
  } else if (roll < 0.5 + aggression * 0.2) {
    tactic = 'pickApart';
  } else {
    tactic = TACTIC_FALLBACK[Math.floor(tacticIdx * TACTIC_FALLBACK.length)];
  }

  return { kind: 'strike', target, tactic };
}
