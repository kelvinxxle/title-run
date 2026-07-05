import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import App from './App';
import { save, load } from './persistence/runStorageV2';
import {
  startRun, applyDraft, startNextFight, startFight, resolveExchange, groundStep,
  ARCHETYPES,
  STAT_IDS, type RunState, type StatLine, type ExchangeMove,
} from './domain/combat';

const LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 55])) as StatLine;
const JAB: ExchangeMove = { kind: 'strike', strike: 'jab' };

function midFightRun(): RunState {
  let run: RunState = applyDraft(startRun('resume-seed'), { name: 'Tester', statLine: LINE });
  run = startNextFight(run);
  // advance one round while still in-round (pick-apart/head is low-pressure — no early finish here)
  if (run.fight && run.fight.phase === 'in-round') run = { ...run, fight: resolveExchange(run.fight, JAB) };
  return run;
}

// A drafted, in-progress run whose active fight is parked in a real 'ground-window'
// (opened by a winning wrestle through resolveExchange). Seed/fightNumber on the fight
// match the run so it satisfies runStorageV2's 'fighting' + 'ground-window' invariants.
const GROUND_SEED = 'resume-ground-seed';
const GRAPPLER: StatLine = { ...ARCHETYPES.wrestler, takedowns: 99 };

function groundWindowRun(): RunState {
  const opp = {
    id: 'o',
    name: 'Opp',
    archetype: 'striker' as const,
    statLine: { ...ARCHETYPES.striker, takedownDef: 20, chin: 1 },
  };
  const f0 = startFight({ seed: GROUND_SEED, fightNumber: 1, playerStatLine: GRAPPLER, opponent: opp });
  const parked = resolveExchange(f0, { kind: 'takedown' });
  // guard: this must genuinely be a valid ground-window per the persistence invariant
  if (parked.phase !== 'ground-window' || parked.window?.method !== 'ground' || parked.outcome !== null) {
    throw new Error('expected a parked ground-window fight');
  }
  const run: RunState = applyDraft(startRun(GROUND_SEED), { name: 'Grappler', statLine: GRAPPLER });
  return { ...run, phase: 'fighting', fight: parked };
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('mid-fight resume (v2)', () => {
  it('persists and reloads the exact in-progress FightState (deep equal)', () => {
    const run = midFightRun();
    save({ run, bestReign: null });
    expect(load().run).toEqual(run); // full run incl. run.fight round/damage/stamina survives the round-trip
  });

  it('App restores the parked fight at its saved round, not round 1', () => {
    const run = midFightRun();
    save({ run, bestReign: null });
    render(<App />);
    const view = screen.getByTestId('fight-view');
    expect(view).toHaveAttribute('data-round', String(run.fight!.round));
    expect(view).toHaveAttribute('data-player-head', String(run.fight!.player.headDamage));
  });
});

describe('ground-window resume (v2)', () => {
  it('persists and reloads a parked ground-window run (deep equal)', () => {
    const run = groundWindowRun();
    save({ run, bestReign: null });
    // The saved ground-window run survives the round-trip exactly (window + fight state).
    expect(load().run).toEqual(run);
  });

  it('App resumes into the GroundPanel, not round 1 or a striking panel', () => {
    const run = groundWindowRun();
    save({ run, bestReign: null });
    render(<App />);
    // Proves App restored the parked ground window: the ground UI renders...
    expect(screen.getByTestId('ground-panel')).toBeInTheDocument();
    // ...and the striking intent panel does NOT.
    expect(screen.queryByTestId('intent-commit')).not.toBeInTheDocument();
  });

  it('groundStep continues deterministically to the same outcome after reload', () => {
    const run = groundWindowRun();
    save({ run, bestReign: null });
    const reloaded = load().run;
    expect(reloaded).not.toBeNull();
    const fromReload = groundStep(reloaded!.fight!, 'ground-and-pound');
    const fromOriginal = groundStep(run.fight!, 'ground-and-pound');
    // Same seed ⇒ identical resolution whether continued from memory or from storage.
    expect(fromReload.outcome).toEqual(fromOriginal.outcome);
    expect(fromReload.outcome).not.toBeNull();
    expect(fromReload.outcome!.winner).toBe('player');
    expect(fromReload.outcome!.method).toBe('KO');
  });
});
