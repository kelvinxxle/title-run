import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import App from './App';
import { save, load } from './persistence/runStorageV2';
import {
  startRun, applyDraft, startNextFight, resolveRound,
  STAT_IDS, type RunState, type StatLine, type RoundIntent,
} from './domain/combat';

const LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 55])) as StatLine;
const JAB: RoundIntent = { where: 'strike', target: 'head', approach: 'technical' };

function midFightRun(): RunState {
  let run: RunState = applyDraft(startRun('resume-seed'), { name: 'Tester', statLine: LINE });
  run = startNextFight(run);
  // advance one round while still in-round (technical/head is low-pressure — no early finish here)
  if (run.fight && run.fight.phase === 'in-round') run = { ...run, fight: resolveRound(run.fight, JAB) };
  return run;
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
