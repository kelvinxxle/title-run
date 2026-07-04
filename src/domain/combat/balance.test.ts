import { describe, it, expect } from 'vitest';
import {
  startFight, resolveRound, finishStep, groundStep, generateOpponent,
  buildStatLine, getFighter,
} from './index';
import type { FightState } from './fightState';
import type { RoundIntent, StrikeTactic, GroundPlan } from './intents';

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

function goodIntent(s: FightState): RoundIntent {
  const me = s.player.statLine;
  const opp = s.opponent.statLine;
  // Shoot the takedown when the opponent's takedownDef is the weak point — i.e. our
  // takedown edge beats our striking edge and is genuinely positive.
  const strikeEdge  = me.striking  - opp.strikingDef;
  const wrestleEdge = me.takedowns - opp.takedownDef;
  if (wrestleEdge > strikeEdge && wrestleEdge > 0) {
    return { kind: 'wrestle' };
  }
  // Otherwise strike and read the moment: pressure a hurt/gassed opponent, press while
  // fresh, drop to a low-cost counter when running low, pick apart when even.
  let tactic: StrikeTactic;
  if (s.opponent.stamina < 25) tactic = 'pressure';
  else if (s.player.stamina > 45) tactic = 'pressure';
  else if (s.player.stamina < 30) tactic = 'counter';
  else tactic = 'pickApart';
  return { kind: 'strike', target: 'head', tactic };
}

function carelessIntent(): RoundIntent {
  return { kind: 'strike', target: 'head', tactic: 'pressure' };
}

// Good play in a ground window: hunt the tap when the opponent's submission
// defense is soft, otherwise pound from top control.
function goodGroundPlan(s: FightState): GroundPlan {
  return s.opponent.statLine.submissionDef < 55 ? 'submission' : 'ground-and-pound';
}

function playFight(init: FightState, policy: 'good' | 'careless'): FightState {
  let s = init;
  let guard = 0;
  while (s.phase !== 'finished') {
    if (guard++ > 300) throw new Error('fight did not terminate');
    if (s.phase === 'in-round') {
      s = resolveRound(s, policy === 'good' ? goodIntent(s) : carelessIntent());
    } else if (s.phase === 'ground-window') {
      // Only good play wrestles, so only good play reaches a player ground window.
      s = groundStep(s, goodGroundPlan(s));
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

// ── M12 T4: co-tuned balance constants (measured across 300 seeds, fightNumbers 1..10) ──────
// Full measurement table in task-4-report.md.

/** Anti-exploit ceiling: pressure-spam must not reliably win vs Tier-5 (fights 9–10).
 *  Achievable-floor: measured max(careless@9=0.3567, careless@10=0.3333) + 0.05 buffer. */
const CARELESS_CEILING_LATE = 0.42;

/** Skill-separation floor: good adaptive play must beat careless by this margin at fights 9–10.
 *  Achievable-floor: measured min(gap@9=0.1300, gap@10=0.1833) − 0.03 buffer. */
const GAP_LATE = 0.10;

describe('combat balance bands', () => {
  const good: Band[] = [];
  const careless: Band[] = [];
  for (let fn = 1; fn <= 10; fn++) {
    good[fn] = simulate(fn, 'good');
    careless[fn] = simulate(fn, 'careless');
  }

  it('BAND 1 — finishes are attainable: good play finishes >= 40% of all fights', () => {
    const totalFinishRate =
      good.slice(1).reduce((sum, b) => sum + b.finishRate, 0) / 10;
    // Tightened 0.30 → 0.40 (M12 T4): measured aggregate finishRate=0.4680; comfortable margin.
    expect(totalFinishRate).toBeGreaterThanOrEqual(0.40);
  });

  it('BAND 2 — early decisions matter: careless is genuinely punished, good play dominates', () => {
    // measured careless@1=0.6933; margin 0.027 — kept at 0.72 (too thin to tighten safely)
    expect(careless[1].winRate).toBeLessThanOrEqual(0.72);
    // Tightened 0.80 → 0.90 (M12 T4): measured good@1=0.9833 vs Tier-1 warm-up.
    expect(good[1].winRate).toBeGreaterThan(0.90);
    // Tightened 0.20 → 0.25 (M12 T4): measured gap@1=0.2900.
    expect(good[1].winRate - careless[1].winRate).toBeGreaterThanOrEqual(0.25);
  });

  it('BAND 3 — no wall: late fights stay winnable with good play', () => {
    // Achievable-floor preserved at 0.45: measured good@9=0.4867, good@10=0.5167 (slim margin).
    // GSP takedowns=90 threads Tier-5 champions via wrestling even vs Jon Jones (fightIQ=94).
    expect(good[9].winRate).toBeGreaterThanOrEqual(0.45);
    expect(good[10].winRate).toBeGreaterThanOrEqual(0.45);
    expect(good[9].winRate).toBeGreaterThan(0);
    expect(good[10].winRate).toBeGreaterThan(0);
  });

  it('BAND 4 — no runaway: difficulty rises with fightNumber (no snowball to 100%)', () => {
    const early = (good[1].winRate + good[2].winRate) / 2;
    const late = (good[9].winRate + good[10].winRate) / 2;
    expect(late).toBeLessThanOrEqual(early);   // late fights are not easier than early
    expect(late).toBeLessThan(0.9);            // late fights remain a real challenge
  });

  it('BAND 5a — anti-exploit: pressure-spam cannot reliably win vs Tier-5 champions', () => {
    // CARELESS_CEILING_LATE=0.42 (achievable-floor, measured M12 T4).
    // Directly encodes the Feature A guarantee: high-IQ Tier-5 opponents punish predictability.
    expect(careless[9].winRate).toBeLessThanOrEqual(CARELESS_CEILING_LATE);
    expect(careless[10].winRate).toBeLessThanOrEqual(CARELESS_CEILING_LATE);
  });

  it('BAND 5b — skill separation late: good adaptive play beats pure pressure by >= GAP_LATE', () => {
    // GAP_LATE=0.10 (achievable-floor: measured min gap 0.1300 − 0.03 buffer).
    // Allrounders/champions read and counter predictable pressure — skill separates.
    expect(good[9].winRate - careless[9].winRate).toBeGreaterThanOrEqual(GAP_LATE);
    expect(good[10].winRate - careless[10].winRate).toBeGreaterThanOrEqual(GAP_LATE);
  });

  it('BAND 6 — difficulty-monotonic: win-rate is non-increasing as fightNumber rises (within noise)', () => {
    // All transitions EXCEPT the documented fight 2→3 matchup dip must be non-increasing
    // (or within a tight 0.10 noise buffer for sim variance).
    const TRANSITION_NOISE = 0.10;
    for (let n = 1; n <= 9; n++) {
      if (n === 2) continue; // fight 2→3 is the documented exception — asserted separately below
      expect(good[n + 1].winRate, `good fight ${n}→${n+1}`).toBeLessThanOrEqual(good[n].winRate + TRANSITION_NOISE);
      expect(careless[n + 1].winRate, `careless fight ${n}→${n+1}`).toBeLessThanOrEqual(careless[n].winRate + TRANSITION_NOISE);
    }
    // Fight 2→3 structural dip (intentional): Tier-2 strikers frustrate GSP's wrestling edge
    // (higher takedownDef) while Tier-3 grapplers have softer takedownDef GSP dominates.
    // Bounded so a real regression still catches.
    // Measured M12 T4: good delta=+0.200, careless delta=+0.354.
    const DIPTIER2TO3_GOOD = 0.25;     // measured +0.200 + 0.05 buffer
    const DIPTIER2TO3_CARELESS = 0.40; // measured +0.354 + ~0.05 buffer
    expect(good[3].winRate - good[2].winRate).toBeLessThanOrEqual(DIPTIER2TO3_GOOD);
    expect(careless[3].winRate - careless[2].winRate).toBeLessThanOrEqual(DIPTIER2TO3_CARELESS);
  });
});
