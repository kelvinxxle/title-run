import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import RoundRecap from './RoundRecap';
import type { RoundReport } from '../domain/combat/report';

describe('RoundRecap', () => {
  const report: RoundReport = {
    round: 1,
    headline: 'You lit him up.',
    detail: 'Body work is adding up — his gas will pay for it.',
    winner: 'player',
    playerHeadDelta: 0,
    playerBodyDelta: 0,
    opponentHeadDelta: 12,
    opponentBodyDelta: 5,
  };

  it('renders the recap container', () => {
    const { container } = render(<RoundRecap report={report} />);
    expect(container.querySelector('[data-testid="round-recap"]')).toBeTruthy();
  });

  it('renders headline text', () => {
    const { getByText } = render(<RoundRecap report={report} />);
    expect(getByText('You lit him up.')).toBeTruthy();
  });

  it('renders detail text', () => {
    const { getByText } = render(<RoundRecap report={report} />);
    expect(getByText('Body work is adding up — his gas will pay for it.')).toBeTruthy();
  });

  it('shows opponent head damage delta chip', () => {
    const { container } = render(<RoundRecap report={report} />);
    expect(container.textContent).toContain('12');
  });
});
