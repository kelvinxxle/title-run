import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import App from './App';
import { save } from './persistence/runStorageV2';
import { startRun, applyDraft, startNextFight, STAT_IDS, type RunState, type StatLine } from './domain/combat';

const LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 55])) as StatLine;

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('App (v2 flow)', () => {
  it('fresh load shows the Hub with Start New Run', () => {
    render(<App />);
    expect(screen.getByTestId('screen-championship-hub')).toBeInTheDocument();
    expect(screen.getByTestId('start-run')).toBeInTheDocument();
  });

  it('Start New Run enters the draft', () => {
    render(<App makeSeed={() => 'seedA'} />);
    fireEvent.click(screen.getByTestId('start-run'));
    expect(screen.getByTestId('screen-draft')).toBeInTheDocument();
  });

  it('pre-fight Hub → Enter the Octagon renders the in-round FightView', () => {
    save({ run: applyDraft(startRun('seedB'), { name: 'Ace', statLine: LINE }), bestReign: null });
    render(<App />);
    fireEvent.click(screen.getByTestId('enter-fight'));
    const view = screen.getByTestId('fight-view');
    expect(view).toHaveAttribute('data-phase', 'in-round');
    expect(screen.getByTestId('intent-panel-v2')).toBeInTheDocument();
  });

  it('committing an intent advances the fight deterministically', () => {
    let run: RunState = applyDraft(startRun('seedC'), { name: 'Ace', statLine: LINE });
    run = startNextFight(run);
    save({ run, bestReign: null });
    render(<App />);
    const view = screen.getByTestId('fight-view');
    const before = view.getAttribute('data-round');
    fireEvent.click(screen.getByTestId('intent-commit'));
    const after = screen.getByTestId('fight-view');
    // either the round advanced or a finish window / finish opened — the view changed
    const changed = after.getAttribute('data-round') !== before || after.getAttribute('data-phase') !== 'in-round';
    expect(changed).toBe(true);
  });

  it('run-over Hub shows the outcome banner and Start New Run', () => {
    const lost: RunState = {
      seed: 'x', phase: 'run-over', fighter: { name: 'Ace', statLine: LINE },
      fightNumber: 2, record: { wins: 1, losses: 1 }, isChampion: false, defenses: 0,
      fight: {
        seed: 'x', fightNumber: 2, rounds: 3, round: 3, phase: 'finished',
        player: { statLine: LINE, headDamage: 40, bodyDamage: 0, stamina: 20, roundScore: 0 },
        opponent: { statLine: LINE, headDamage: 5, bodyDamage: 0, stamina: 50, roundScore: 0, name: 'Rival', archetype: 'brawler' },
        window: null, outcome: { winner: 'opponent', method: 'KO', round: 3 }, log: [],
      },
    };
    save({ run: lost, bestReign: null });
    render(<App />);
    expect(screen.getByTestId('outcome-banner')).toBeInTheDocument();
    expect(screen.getByTestId('start-run')).toBeInTheDocument();
  });
});
