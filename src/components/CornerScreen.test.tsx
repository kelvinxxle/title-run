import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import CornerScreen from './CornerScreen';
import type { RoundReport } from '../domain/combat/report';

describe('CornerScreen', () => {
  const report: RoundReport = {
    round: 1,
    headline: 'You took the round.',
    detail: 'Body work is adding up.',
    winner: 'player',
    playerHeadDelta: 0,
    playerBodyDelta: 0,
    opponentHeadDelta: 8,
    opponentBodyDelta: 3,
  };

  const log = [
    {
      round: 1,
      exchange: 1 as const,
      winner: 'player' as const,
      playerIntent: { kind: 'strike' as const, strike: 'jab' as const },
      opponentIntent: { kind: 'strike' as const, strike: 'powerPunch' as const },
      dominance: 8,
    },
  ];

  it('renders the corner screen container', () => {
    const { container } = render(
      <CornerScreen
        report={report}
        log={log}
        rounds={3}
        nextRound={2}
        onChoosePlan={vi.fn()}
      />,
    );
    expect(container.querySelector('[data-testid="corner-screen"]')).toBeTruthy();
  });

  it('renders all 4 game-plan buttons', () => {
    const { container } = render(
      <CornerScreen report={report} log={log} rounds={3} nextRound={2} onChoosePlan={vi.fn()} />,
    );
    expect(container.querySelector('[data-testid="plan-push-pace"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="plan-work-body"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="plan-stay-disciplined"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="plan-catch-breath"]')).toBeTruthy();
  });

  it('calls onChoosePlan with the correct plan when a card is clicked', () => {
    const onChoosePlan = vi.fn();
    const { container } = render(
      <CornerScreen report={report} log={log} rounds={3} nextRound={2} onChoosePlan={onChoosePlan} />,
    );
    const btn = container.querySelector('[data-testid="plan-work-body"]') as HTMLElement;
    fireEvent.click(btn);
    expect(onChoosePlan).toHaveBeenCalledWith('work-body');
  });

  it('renders the round recap when report is provided', () => {
    const { container } = render(
      <CornerScreen report={report} log={log} rounds={3} nextRound={2} onChoosePlan={vi.fn()} />,
    );
    expect(container.querySelector('[data-testid="round-recap"]')).toBeTruthy();
  });

  it('renders the momentum bar', () => {
    const { container } = render(
      <CornerScreen report={report} log={log} rounds={3} nextRound={2} onChoosePlan={vi.fn()} />,
    );
    expect(container.querySelector('[data-testid="momentum-bar"]')).toBeTruthy();
  });
});
