import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChampionshipHubScreen from './ChampionshipHubScreen';
import { startRun, applyDraft, type RunState } from '../domain';

const PLAYER = { boxing:82, kicks:92, clinch:80, takedowns:98, submissions:97, topControl:88, cardio:90, chin:88, fightIQ:78 };
function preFight(over: Partial<RunState> = {}): RunState {
  return { ...applyDraft(startRun('run-42'), { name: 'Kelvin', statLine: PLAYER }), ...over };
}

function runOver(partial: Partial<RunState>): RunState {
  return { ...startRun('x'), phase: 'run-over', ...partial };
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

  it('run-over shows the new-record flourish when isNewRecord', () => {
    render(<ChampionshipHubScreen run={runOver({ isChampion: true, defenses: 2 })} bestReign={1} isNewRecord onStartRun={() => {}} onEnterFight={() => {}} />);
    expect(screen.getByTestId('new-record')).toBeInTheDocument();
  });

  it('run-over hides the flourish when not a record', () => {
    render(<ChampionshipHubScreen run={runOver({ isChampion: false, defenses: 0 })} bestReign={2} isNewRecord={false} onStartRun={() => {}} onEnterFight={() => {}} />);
    expect(screen.queryByTestId('new-record')).toBeNull();
  });

  it('shows the best-reign number to beat on the landing', () => {
    render(<ChampionshipHubScreen run={null} bestReign={3} onStartRun={() => {}} onEnterFight={() => {}} />);
    expect(screen.getByTestId('best-reign')).toHaveTextContent(/best reign: 3/i);
  });

  it('shows "No title yet" on the landing when best is null', () => {
    render(<ChampionshipHubScreen run={null} bestReign={null} onStartRun={() => {}} onEnterFight={() => {}} />);
    expect(screen.getByTestId('best-reign')).toHaveTextContent(/no title yet/i);
  });
});
