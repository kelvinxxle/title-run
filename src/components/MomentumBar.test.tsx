import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import MomentumBar from './MomentumBar';

describe('MomentumBar', () => {
  it('renders the momentum bar container', () => {
    const { container } = render(<MomentumBar log={[]} rounds={3} />);
    expect(container.querySelector('[data-testid="momentum-bar"]')).toBeTruthy();
  });

  it('renders correct number of pips', () => {
    const { container } = render(<MomentumBar log={[]} rounds={5} />);
    const pips = container.querySelectorAll('[data-winner]');
    expect(pips).toHaveLength(5);
  });

  it('colors pips by winner', () => {
    const log = [
      { round: 1, winner: 'player' as const, playerIntent: { kind: 'strike' as const, target: 'head' as const, tactic: 'pressure' as const }, opponentIntent: { kind: 'strike' as const, target: 'head' as const, tactic: 'pressure' as const }, dominance: 5 },
      { round: 2, winner: 'opponent' as const, playerIntent: { kind: 'strike' as const, target: 'head' as const, tactic: 'pressure' as const }, opponentIntent: { kind: 'strike' as const, target: 'head' as const, tactic: 'pressure' as const }, dominance: -5 },
    ];
    const { container } = render(<MomentumBar log={log} rounds={3} />);
    const pips = container.querySelectorAll('[data-winner]');
    expect(pips[0].getAttribute('data-winner')).toBe('player');
    expect(pips[1].getAttribute('data-winner')).toBe('opponent');
    expect(pips[2].getAttribute('data-winner')).toBe('none');
  });
});
