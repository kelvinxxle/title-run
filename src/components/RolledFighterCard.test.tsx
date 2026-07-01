import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RolledFighterCard from './RolledFighterCard';
import { startDraft, keepStat } from '../domain/draft';

describe('RolledFighterCard', () => {
  it('shows the current fighter and keeps a stat on click', async () => {
    const onKeep = vi.fn();
    render(<RolledFighterCard state={startDraft('title-run')} onKeep={onKeep} />);
    expect(screen.getByRole('heading', { name: /charles oliveira/i })).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('suggested-stat'));
    expect(onKeep).toHaveBeenCalledWith('submissions');
  });

  it('renders already-filled slots as non-interactive', () => {
    const state = keepStat(startDraft('title-run'), 'submissions');
    render(<RolledFighterCard state={state} onKeep={() => {}} />);
    expect(screen.getByTestId('filled-stat-submissions')).toBeInTheDocument();
  });
});
