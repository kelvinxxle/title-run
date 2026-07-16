import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GroundPanel from './GroundPanel';
import type { GroundState } from '../domain/combat';

const at = (position: any) => ({ position }) as GroundState;

describe('GroundPanel', () => {
  it('shows current position and always offers ground & pound', () => {
    const onGroundAction = vi.fn();
    render(<GroundPanel ground={at('side-control')} onGroundAction={onGroundAction} />);
    expect(screen.getByText(/Side Control/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ground-gnp'));
    expect(onGroundAction).toHaveBeenCalledWith('ground-and-pound');
  });

  it('hides advance at the back (no further position) and labels the submission by position', () => {
    const onGroundAction = vi.fn();
    render(<GroundPanel ground={at('back')} onGroundAction={onGroundAction} />);
    expect(screen.queryByTestId('ground-advance')).toBeNull();
    expect(screen.getByTestId('ground-sub')).toHaveTextContent(/Rear-Naked Choke/i);
    fireEvent.click(screen.getByTestId('ground-sub'));
    expect(onGroundAction).toHaveBeenCalledWith('submission');
  });

  it('hides submission in neutral guard (no submission available)', () => {
    render(<GroundPanel ground={at('guard')} onGroundAction={vi.fn()} />);
    expect(screen.queryByTestId('ground-sub')).toBeNull();
    expect(screen.getByTestId('ground-advance')).toBeInTheDocument();
  });
});
