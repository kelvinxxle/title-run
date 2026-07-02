import { describe, it, expect } from 'vitest';
import {
  startFight, resolveRound, finishStep, generateOpponent,
  buildStatLine, getFighter,
} from './index';
import type { FightState } from './fightState';
import type { RoundIntent, Where } from './intents';

// ─────────────────────────────────────────────────────────────────────────────
// Balance harness (M8a success criteria).
//
// A seeded simulator that plays complete fights with two contrasting policies:
//
//  • "good play"  — attacks the opponent's weakest defense, manages stamina
//    (backs off to recover, presses when fresh or when the opponent is gassed),
//    commits to its own finish windows, and stays composed while defending the
//    opponent's finish windows.
//  • "careless"   — always pressures the head with strikes regardless of
//    matchup or stamina, and always commits in every finish window (including
//    while being finished).
//
// We measure across fightNumber 1..10 and many deterministic seeds, then assert
// the four success bands. There is no Math.random anywhere — every draw flows
// through the engine's seeded RNG, so the measured numbers are reproducible.
// ─────────────────────────────────────────────────────────────────────────────

const PLAYER = buildStatLine(getFighter('georges-st-pierre'));

const WHERES: readonly Where[] = ['strike', 'wrestle', 'grapple'];
const OFF = { strike: 'striking', wrestle: 'takedowns', grapple: 'submissions' } as const;
const DEF = { strike: 'strikingDef', wrestle: 'takedownDef', grapple: 'submissionDef' } as const;

function goodIntent(s: FightState): RoundIntent {
  const me = s.player.statLine;
  const opp = s.opponent.statLine;
  // Attack the phase where our edge over their defense is largest.
  let best: Where = 'strike';
  let bestEdge = -Infinity;
  for (const w of WHERES) {
    const edge = me[OFF[w]] - opp[DEF[w]];
    if (edge > bestEdge) { bestEdge = edge; best = w; }
  }
  // Manage stamina: swarm a gassed opponent, press while fresh, otherwise
  // fight technically, and drop to a low-cost counter when running low.
  let approach: RoundIntent['approach'];
  if (s.opponent.stamina < 25) approach = 'pressure';
  else if (s.player.stamina > 45) approach = 'pressure';
  else if (s.player.stamina < 30) approach = 'counter';
  else approach = 'technical';
  return { where: best, target: 'head', approach };
}

function carelessIntent(): RoundIntent {
  return { where: 'strike', target: 'head', approach: 'pressure' };
}

function playFight(init: FightState, policy: 'good' | 'careless'): FightState {
  let s = init;
  let guard = 0;
  while (s.phase !== 'finished') {
    if (guard++ > 300) throw new Error('fight did not terminate');
    if (s.phase === 'in-round') {
      s = resolveRound(s, policy === 'good' ? goodIntent(s) : carelessIntent());
    } else {
      const window = s.window!;
      // Good play seizes its own windows and defends composed when hunted;
      // careless swings for the fences either way.
      const choice = policy === 'good'
        ? (window.side === 'player' ? 'commit' : 'hold')
        : 'commit';
      s = finishStep(s, choice);
    }
  }
  return s;
}

const SEEDS = 300;

interface Band { winRate: number; finishRate: number; }

function simulate(fightNumber: number, policy: 'good' | 'careless'): Band {
  let wins = 0;
  let finishes = 0;
  for (let i = 0; i < SEEDS; i++) {
    const seed = `balance#${policy}#${i}`;
    const opponent = generateOpponent(seed, fightNumber);
    const s0 = startFight({ seed, fightNumber, playerStatLine: PLAYER, opponent });
    const done = playFight(s0, policy);
    const outcome = done.outcome!;
    if (outcome.winner === 'player') {
      wins++;
      if (outcome.method !== 'decision') finishes++;
    }
  }
  return { winRate: wins / SEEDS, finishRate: finishes / SEEDS };
}

describe('combat balance bands', () => {
  const good: Band[] = [];
  const careless: Band[] = [];
  for (let fn = 1; fn <= 10; fn++) {
    good[fn] = simulate(fn, 'good');
    careless[fn] = simulate(fn, 'careless');
  }

  it('BAND 1 — finishes are attainable: good play finishes >= 25% of all fights', () => {
    const totalFinishRate =
      good.slice(1).reduce((sum, b) => sum + b.finishRate, 0) / 10;
    expect(totalFinishRate).toBeGreaterThanOrEqual(0.25);
  });

  it('BAND 2 — early decisions matter: careless is genuinely punished, good play dominates', () => {
    expect(careless[1].winRate).toBeLessThanOrEqual(0.80);        // reckless play loses meaningfully even at fight 1
    expect(good[1].winRate).toBeGreaterThan(0.8);                 // good play wins the large majority
    expect(good[1].winRate - careless[1].winRate).toBeGreaterThanOrEqual(0.15); // good beats careless by >= 15 points
  });

  it('BAND 3 — no wall: late fights stay winnable with good play', () => {
    expect(good[9].winRate).toBeGreaterThanOrEqual(0.4);
    expect(good[10].winRate).toBeGreaterThanOrEqual(0.4);
    expect(good[9].winRate).toBeGreaterThan(0);
    expect(good[10].winRate).toBeGreaterThan(0);
  });

  it('BAND 4 — no runaway: difficulty rises with fightNumber (no snowball to 100%)', () => {
    const early = (good[1].winRate + good[2].winRate) / 2;
    const late = (good[9].winRate + good[10].winRate) / 2;
    expect(late).toBeLessThanOrEqual(early);   // late fights are not easier than early
    expect(late).toBeLessThan(0.9);            // late fights remain a real challenge
  });
});
