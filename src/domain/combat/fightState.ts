import type { StatLine } from './stats';
import { PHASE_OFFENSE } from './stats';
import type { RoundIntent, Where, Approach } from './intents';
import { APPROACHES } from './intents';
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

export type FightPhase = 'in-round' | 'finish-window' | 'finished';

export interface FinishWindow {
  side: 'player' | 'opponent';
  method: 'KO' | 'submission';
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

  // Choose where: strongest offense stat among strike/wrestle/grapple
  const phases: Array<{ where: Where; stat: number }> = [
    { where: 'strike', stat: state.opponent.statLine[PHASE_OFFENSE.strike] },
    { where: 'wrestle', stat: state.opponent.statLine[PHASE_OFFENSE.wrestle] },
    { where: 'grapple', stat: state.opponent.statLine[PHASE_OFFENSE.grapple] },
  ];
  const where: Where = phases.reduce((best, cur) => (cur.stat > best.stat ? cur : best)).where;

  // Choose target: body when player is gassed, else head
  const target = isGassed(state.player.stamina) ? 'body' : 'head';

  // Choose approach biased by fightNumber (higher → more aggressive)
  // fightNumber 1-4: favour technical/counter; 5+: favour pressure
  const aggression = Math.min(1, (state.fightNumber - 1) / 4); // 0..1
  const roll = rng();
  let approach: Approach;
  if (roll < aggression * 0.6) {
    approach = 'pressure';
  } else if (roll < 0.5 + aggression * 0.2) {
    approach = 'technical';
  } else {
    approach = APPROACHES[Math.floor(rng() * APPROACHES.length)];
  }

  return { where, target, approach };
}
