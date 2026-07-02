import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
import { STORAGE_KEY } from './persistence/runStorage';
import { STAT_IDS } from './domain';
const SAMPLE_STAT_LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 50])) as import('./domain').StatLine;

describe('App run loop', () => {
  it('landing → draft → pre-fight → fight → reward → next fight', () => {
    render(<App makeSeed={() => 'run-42'} />);

    // landing
    fireEvent.click(screen.getByTestId('start-run'));

    // draft: keep suggested 9x, then name
    for (let i = 0; i < 9; i++) fireEvent.click(screen.getByTestId('suggested-stat'));
    fireEvent.change(screen.getByLabelText(/fighter name/i), { target: { value: 'Kelvin' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm fighter/i }));

    // pre-fight hub → enter octagon
    expect(screen.getByTestId('screen-championship-hub')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('enter-fight'));

    // fight: strike x3 => decision win round 3 (seeded run-42 fight 1)
    fireEvent.click(screen.getByTestId('intent-strike'));
    fireEvent.click(screen.getByTestId('intent-strike'));
    fireEvent.click(screen.getByTestId('intent-strike'));

    // reward: bump boxing, confirm
    expect(screen.getByTestId('screen-reward')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('reward-type-bump'));
    fireEvent.click(screen.getByTestId('reward-stat-boxing'));
    fireEvent.click(screen.getByTestId('reward-confirm'));

    // back at the hub, now fight 2
    expect(screen.getByTestId('screen-championship-hub')).toBeInTheDocument();
    expect(screen.getByTestId('run-status')).toHaveTextContent(/fight 2/i);
  });
});

describe('App persistence', () => {
  it('autosaves the run to localStorage after a transition', () => {
    render(<App makeSeed={() => 'run-42'} />);
    fireEvent.click(screen.getByTestId('start-run'));
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.version).toBe(1);
    expect(saved.run.phase).toBe('drafting');
    expect(saved.run.seed).toBe('run-42');
  });

  it('hydrates the exact phase from a saved blob on mount', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      run: { seed: 'run-42', phase: 'pre-fight', fighter: { name: 'Kelvin', statLine: SAMPLE_STAT_LINE }, fightNumber: 3, carriedDamage: 0, record: { wins: 2, losses: 0 }, isChampion: false, defenses: 0, fight: null },
      bestReign: null,
    }));
    render(<App makeSeed={() => 'unused'} />);
    expect(screen.getByTestId('screen-championship-hub')).toBeInTheDocument();
    expect(screen.getByTestId('run-status')).toHaveTextContent(/fight 3/i);
  });

  it('celebrates a new best reign on a champion run-over and commits it on Start New Run', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      run: { seed: 'run-42', phase: 'run-over', fighter: null, fightNumber: 6, carriedDamage: 0, record: { wins: 5, losses: 1 }, isChampion: true, defenses: 2, fight: { outcome: { method: 'decision', round: 5, winner: 'opponent' } } },
      bestReign: 1,
    }));
    render(<App makeSeed={() => 'next-run'} />);
    expect(screen.getByTestId('new-record')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('start-run'));
    // now drafting a fresh run; the reign was committed to max(1, 2) = 2
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.bestReign).toBe(2);
    expect(saved.run.phase).toBe('drafting');
    expect(screen.queryByTestId('new-record')).toBeNull();
  });
});

