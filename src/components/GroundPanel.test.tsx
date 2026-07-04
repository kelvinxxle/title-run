import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GroundPanel from './GroundPanel';
import type { FinishWindow } from '../domain/combat';

const GROUND_WIN: FinishWindow = { side: 'player', method: 'ground', stepsLeft: 3 };

describe('GroundPanel', () => {
  it('renders top-control framing with both plan buttons', () => {
    render(<GroundPanel window={GROUND_WIN} onGround={vi.fn()} />);
    expect(screen.getByTestId('ground-panel')).toHaveAttribute('data-side', 'player');
    expect(screen.getByTestId('ground-panel')).toHaveTextContent('TOP CONTROL');
    expect(screen.getByTestId('ground-gnp')).toHaveTextContent('Ground & Pound');
    expect(screen.getByTestId('ground-sub')).toHaveTextContent('Submission');
    expect(screen.queryByTestId('ground-steps')).toBeNull();
    expect(screen.getByTestId('ground-panel')).toHaveTextContent('pick your finish');
  });

  it('forwards ground-and-pound', () => {
    const onGround = vi.fn();
    render(<GroundPanel window={GROUND_WIN} onGround={onGround} />);
    fireEvent.click(screen.getByTestId('ground-gnp'));
    expect(onGround).toHaveBeenCalledWith('ground-and-pound');
  });

  it('forwards submission', () => {
    const onGround = vi.fn();
    render(<GroundPanel window={GROUND_WIN} onGround={onGround} />);
    fireEvent.click(screen.getByTestId('ground-sub'));
    expect(onGround).toHaveBeenCalledWith('submission');
  });

  it('does not fire when disabled', () => {
    const onGround = vi.fn();
    render(<GroundPanel window={GROUND_WIN} onGround={onGround} disabled />);
    fireEvent.click(screen.getByTestId('ground-gnp'));
    fireEvent.click(screen.getByTestId('ground-sub'));
    expect(onGround).not.toHaveBeenCalled();
  });
});
