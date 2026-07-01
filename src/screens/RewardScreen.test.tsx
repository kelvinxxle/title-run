import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RewardScreen from './RewardScreen';
import { startRun, applyDraft, type RunState } from '../domain';

const PLAYER = { boxing:82, kicks:92, clinch:80, takedowns:98, submissions:97, topControl:88, cardio:90, chin:88, fightIQ:78 };

function rewardRun(over: Partial<RunState> = {}): RunState {
  return {
    ...applyDraft(startRun('run-42'), { name: 'Kelvin', statLine: PLAYER }),
    phase: 'reward',
    fight: { outcome: { winner: 'player', method: 'decision', round: 3 } } as any,
    ...over,
  };
}

describe('RewardScreen', () => {
  it('shows the outcome banner and three reward types', () => {
    render(<RewardScreen run={rewardRun()} onReward={() => {}} />);
    expect(screen.getByTestId('screen-reward')).toBeInTheDocument();
    expect(screen.getByTestId('outcome-banner')).toBeInTheDocument();
    expect(screen.getByTestId('reward-type-bump')).toBeInTheDocument();
    expect(screen.getByTestId('reward-type-reroll')).toBeInTheDocument();
    expect(screen.getByTestId('reward-type-recover')).toBeInTheDocument();
  });

  it('disables recover when there is no carried damage', () => {
    render(<RewardScreen run={rewardRun({ carriedDamage: 0 })} onReward={() => {}} />);
    expect(screen.getByTestId('reward-type-recover')).toBeDisabled();
  });

  it('emits recover immediately', () => {
    const onReward = vi.fn();
    render(<RewardScreen run={rewardRun({ carriedDamage: 40 })} onReward={onReward} />);
    fireEvent.click(screen.getByTestId('reward-type-recover'));
    expect(onReward).toHaveBeenCalledWith({ type: 'recover' });
  });

  it('bump: pick type -> stat -> preview shows from -> to, confirm emits', () => {
    const onReward = vi.fn();
    render(<RewardScreen run={rewardRun()} onReward={onReward} />);
    fireEvent.click(screen.getByTestId('reward-type-bump'));
    fireEvent.click(screen.getByTestId('reward-stat-boxing'));
    expect(screen.getByTestId('reward-preview')).toHaveTextContent(/82.*90/);
    fireEvent.click(screen.getByTestId('reward-confirm'));
    expect(onReward).toHaveBeenCalledWith({ type: 'bump', stat: 'boxing' });
  });

  it('reroll: preview hides the drawn value (gamble)', () => {
    render(<RewardScreen run={rewardRun()} onReward={() => {}} />);
    fireEvent.click(screen.getByTestId('reward-type-reroll'));
    fireEvent.click(screen.getByTestId('reward-stat-boxing'));
    expect(screen.getByTestId('reward-preview')).toHaveTextContent(/\?\?/);
  });

  it('back returns to the type step', () => {
    render(<RewardScreen run={rewardRun()} onReward={() => {}} />);
    fireEvent.click(screen.getByTestId('reward-type-bump'));
    fireEvent.click(screen.getByTestId('reward-back'));
    expect(screen.getByTestId('reward-type-bump')).toBeInTheDocument();
  });
});
