import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SlotStatusChips from './SlotStatusChips';
import { startDraft, keepStat } from '../domain/combat';

describe('SlotStatusChips', () => {
  it('renders a chip for every stat', () => {
    render(<SlotStatusChips slots={startDraft('title-run').slots} />);
    expect(screen.getByTestId('chip-striking')).toBeInTheDocument();
    expect(screen.getByTestId('chip-fightIQ')).toBeInTheDocument();
  });

  it('reflects a filled slot', () => {
    const state = keepStat(startDraft('title-run'), 'submissions');
    render(<SlotStatusChips slots={state.slots} />);
    expect(screen.getByTestId('chip-submissions').className).not.toContain('border-dashed');
  });
});
