import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import App from './App';
import { save } from './persistence/runStorageV2';
import { startRun, applyDraft, startNextFight, finishStep, STAT_IDS, type RunState, type StatLine, type FightState } from './domain/combat';

const LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 55])) as StatLine;

function fightingRun(fight: FightState): RunState {
  return {
    seed: fight.seed, phase: 'fighting', fighter: { name: 'Ace', statLine: LINE },
    fightNumber: fight.fightNumber, record: { wins: 0, losses: 0 }, isChampion: false, defenses: 0, fight,
  };
}
function finishWindowFight(): FightState {
  return {
    seed: 'fw', fightNumber: 1, rounds: 3, round: 2, phase: 'finish-window',
    player: { statLine: LINE, headDamage: 10, bodyDamage: 0, stamina: 40, roundScore: 1 },
    opponent: { statLine: LINE, headDamage: 60, bodyDamage: 0, stamina: 20, roundScore: 0, name: 'Rival', archetype: 'brawler' },
    window: { side: 'player', method: 'KO', stepsLeft: 2 }, outcome: null, log: [],
    gamePlan: null, lastReport: null,
  };
}
function finishedFight(winner: 'player' | 'opponent'): FightState {
  return {
    seed: 'done', fightNumber: 1, rounds: 3, round: 3, phase: 'finished',
    player: { statLine: LINE, headDamage: winner === 'opponent' ? 60 : 5, bodyDamage: 0, stamina: 30, roundScore: 0 },
    opponent: { statLine: LINE, headDamage: winner === 'player' ? 60 : 5, bodyDamage: 0, stamina: 30, roundScore: 0, name: 'Rival', archetype: 'brawler' },
    window: null, outcome: { winner, method: 'KO', round: 3 }, log: [],
    gamePlan: null, lastReport: null,
  };
}
function cornerFight(): FightState {
  return {
    seed: 'corner', fightNumber: 1, rounds: 3, round: 2, phase: 'corner',
    player: { statLine: LINE, headDamage: 5, bodyDamage: 0, stamina: 70, roundScore: 1 },
    opponent: { statLine: LINE, headDamage: 10, bodyDamage: 3, stamina: 60, roundScore: 0, name: 'Rival', archetype: 'brawler' },
    window: null,
    outcome: null,
    log: [],
    gamePlan: null,
    lastReport: {
      round: 1,
      headline: 'You took the round.',
      detail: 'You picked him apart at range.',
      winner: 'player',
      playerHeadDelta: 0,
      playerBodyDelta: 0,
      opponentHeadDelta: 10,
      opponentBodyDelta: 3,
    },
  };
}

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
        gamePlan: null, lastReport: null,
      },
    };
    save({ run: lost, bestReign: null });
    render(<App />);
    expect(screen.getByTestId('outcome-banner')).toBeInTheDocument();
    expect(screen.getByTestId('start-run')).toBeInTheDocument();
  });

  it('finish-window choice routes through finishStep (controller wiring)', () => {
    const fight = finishWindowFight();
    save({ run: fightingRun(fight), bestReign: null });
    render(<App />);
    expect(screen.getByTestId('fight-view')).toHaveAttribute('data-phase', 'finish-window');
    fireEvent.click(screen.getByTestId('finish-commit'));
    const expected = finishStep(fight, 'commit').phase;
    expect(screen.getByTestId('fight-view')).toHaveAttribute('data-phase', expected);
  });

  it('corner choice routes through chooseGamePlan and returns to in-round', () => {
    save({ run: fightingRun(cornerFight()), bestReign: null });
    render(<App />);
    expect(screen.getByTestId('fight-view')).toHaveAttribute('data-phase', 'corner');
    fireEvent.click(screen.getByTestId('plan-push-pace'));
    expect(screen.getByTestId('fight-view')).toHaveAttribute('data-phase', 'in-round');
    expect(screen.getByTestId('intent-panel-v2')).toBeInTheDocument();
  });

  it('Continue after a player win settles the fight and returns to the pre-fight Hub', () => {
    save({ run: fightingRun(finishedFight('player')), bestReign: null });
    render(<App />);
    fireEvent.click(screen.getByTestId('fight-continue'));
    expect(screen.getByTestId('screen-championship-hub')).toBeInTheDocument();
    expect(screen.getByTestId('enter-fight')).toBeInTheDocument();
  });

  it('Continue after a loss settles the fight and shows the run-over Hub', () => {
    save({ run: fightingRun(finishedFight('opponent')), bestReign: null });
    render(<App />);
    fireEvent.click(screen.getByTestId('fight-continue'));
    expect(screen.getByTestId('outcome-banner')).toBeInTheDocument();
    expect(screen.getByTestId('start-run')).toBeInTheDocument();
  });
});
