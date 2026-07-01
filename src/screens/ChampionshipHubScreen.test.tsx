import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChampionshipHubScreen from './ChampionshipHubScreen';
import { startRun, applyDraft, type RunState } from '../domain';

const PLAYER = { boxing:82, kicks:92, clinch:80, takedowns:98, submissions:97, topControl:88, cardio:90, chin:88, fightIQ:78 };
function preFight(over: Partial<RunState> = {}): RunState {
  return { ...applyDraft(startRun('run-42'), { name: 'Kelvin', statLine: PLAYER }), ...over };
}

describe('ChampionshipHubScreen', () => {
  it('landing: shows Start New Run when there is no run', () => {
    const onStartRun = vi.fn();
    render(<ChampionshipHubScreen run={null} onStartRun={onStartRun} onEnterFight={() => {}} />);
    fireEvent.click(screen.getByTestId('start-run'));
    expect(onStartRun).toHaveBeenCalled();
  });

  it('climb: shows the next opponent and enters the fight', () => {
    const onEnterFight = vi.fn();
    render(<ChampionshipHubScreen run={preFight({ fightNumber: 1 })} onStartRun={() => {}} onEnterFight={onEnterFight} />);
    expect(screen.getByTestId('next-opponent')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('enter-fight'));
    expect(onEnterFight).toHaveBeenCalled();
  });

  it('title bout: reads For the Vacant Belt at fight 5', () => {
    render(<ChampionshipHubScreen run={preFight({ fightNumber: 5 })} onStartRun={() => {}} onEnterFight={() => {}} />);
    expect(screen.getByText(/vacant belt/i)).toBeInTheDocument();
  });

  it('champion: shows reign count at fight 6+', () => {
    render(<ChampionshipHubScreen run={preFight({ fightNumber: 6, isChampion: true, defenses: 2 })} onStartRun={() => {}} onEnterFight={() => {}} />);
    expect(screen.getByText(/reign 2/i)).toBeInTheDocument();
  });

  it('run-over: shows the outcome banner and Start New Run', () => {
    const run = preFight({
      phase: 'run-over',
      record: { wins: 3, losses: 1 },
      fight: { outcome: { winner: 'opponent', method: 'KO', round: 2 } } as any,
    });
    render(<ChampionshipHubScreen run={run} onStartRun={() => {}} onEnterFight={() => {}} />);
    expect(screen.getByTestId('outcome-banner')).toBeInTheDocument();
    expect(screen.getByTestId('start-run')).toBeInTheDocument();
  });

  it('run-over (pre-title loss): shows Reign 0 with record and method', () => {
    const run = preFight({
      phase: 'run-over',
      record: { wins: 2, losses: 1 },
      fight: { outcome: { winner: 'opponent', method: 'KO', round: 2 } } as any,
    });
    render(<ChampionshipHubScreen run={run} onStartRun={() => {}} onEnterFight={() => {}} />);
    expect(screen.getByText(/reign 0/i)).toBeInTheDocument();
    expect(screen.getByText('Record 2\u20131')).toBeInTheDocument();
    expect(screen.getByText(/KO · Round 2/i)).toBeInTheDocument();
  });
});
