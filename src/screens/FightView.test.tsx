import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FightView from './FightView';
import type { FightState } from '../domain/combat';

const base = (over: Partial<FightState> = {}): FightState => ({
  seed: 's', fightNumber: 1, rounds: 3, round: 1, phase: 'in-round',
  player: { statLine: { striking:60, strikingDef:60, takedowns:60, takedownDef:60, submissions:60, submissionDef:60, cardio:60, chin:60, fightIQ:60 }, headDamage:0, bodyDamage:0, stamina:100, roundScore:0 },
  opponent: { statLine: { striking:60, strikingDef:60, takedowns:60, takedownDef:60, submissions:60, submissionDef:60, cardio:60, chin:60, fightIQ:60 }, headDamage:0, bodyDamage:0, stamina:100, roundScore:0, name:'Rival', archetype:'Boxer' },
  window: null, outcome: null, log: [], ...over,
});

describe('FightView', () => {
  it('in-round: shows the intent panel and forwards a committed intent', () => {
    const onIntent = vi.fn();
    render(<FightView fightState={base()} playerName="Me" onIntent={onIntent} onFinishStep={vi.fn()} onGroundStep={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByTestId('intent-panel-v2')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('intent-commit'));
    expect(onIntent).toHaveBeenCalledWith({ kind:'strike', target:'head', tactic:'pickApart' });
    expect(screen.getByTestId('fight-view')).toHaveAttribute('data-round', '1');
  });

  it('finish-window: shows the finish panel and forwards a choice', () => {
    const onFinishStep = vi.fn();
    const st = base({ phase:'finish-window', window:{ side:'player', method:'KO', stepsLeft:3 } });
    render(<FightView fightState={st} playerName="Me" onIntent={vi.fn()} onFinishStep={onFinishStep} onGroundStep={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByTestId('finish-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('finish-commit'));
    expect(onFinishStep).toHaveBeenCalledWith('commit');
  });

  it('ground-window: shows the ground panel and forwards a plan', () => {
    const onGroundStep = vi.fn();
    const st = base({ phase:'ground-window', window:{ side:'player', method:'ground', stepsLeft:3 } });
    render(<FightView fightState={st} playerName="Me" onIntent={vi.fn()} onFinishStep={vi.fn()} onGroundStep={onGroundStep} onContinue={vi.fn()} />);
    expect(screen.getByTestId('ground-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ground-sub'));
    expect(onGroundStep).toHaveBeenCalledWith('submission');
  });

  it('finished: shows the outcome and Continue', () => {
    const onContinue = vi.fn();
    const st = base({ phase:'finished', outcome:{ winner:'player', method:'KO', round:2 } });
    render(<FightView fightState={st} playerName="Me" onIntent={vi.fn()} onFinishStep={vi.fn()} onGroundStep={vi.fn()} onContinue={onContinue} />);
    expect(screen.getByTestId('outcome-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('fight-continue'));
    expect(onContinue).toHaveBeenCalled();
  });
});
