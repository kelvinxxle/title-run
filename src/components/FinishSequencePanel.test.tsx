import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FinishSequencePanel from './FinishSequencePanel';
import type { FinishWindow } from '../domain/combat';

const PLAYER_WIN: FinishWindow = { side:'player', method:'KO', stepsLeft:3 };
const OPP_WIN: FinishWindow = { side:'opponent', method:'submission', stepsLeft:2 };

describe('FinishSequencePanel', () => {
  it('offers all three choices and forwards the picked one', () => {
    const onChoice = vi.fn();
    render(<FinishSequencePanel window={PLAYER_WIN} onChoice={onChoice} />);
    fireEvent.click(screen.getByTestId('finish-commit'));
    expect(onChoice).toHaveBeenCalledWith('commit');
  });

  it('shows an offensive framing for a player window', () => {
    render(<FinishSequencePanel window={PLAYER_WIN} onChoice={vi.fn()} />);
    expect(screen.getByTestId('finish-panel')).toHaveAttribute('data-side', 'player');
    expect(screen.getByTestId('finish-steps')).toHaveTextContent('3');
  });

  it('shows a defensive framing for an opponent window', () => {
    render(<FinishSequencePanel window={OPP_WIN} onChoice={vi.fn()} />);
    expect(screen.getByTestId('finish-panel')).toHaveAttribute('data-side', 'opponent');
  });

  it('does not fire when disabled', () => {
    const onChoice = vi.fn();
    render(<FinishSequencePanel window={PLAYER_WIN} onChoice={onChoice} disabled />);
    fireEvent.click(screen.getByTestId('finish-commit'));
    expect(onChoice).not.toHaveBeenCalled();
  });
});
