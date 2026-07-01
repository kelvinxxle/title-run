import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import OutcomeBanner from './OutcomeBanner';

describe('OutcomeBanner', () => {
  it('announces a player win with method and round', () => {
    render(<OutcomeBanner outcome={{ winner: 'player', method: 'decision', round: 3 } as any} />);
    expect(screen.getByTestId('outcome-banner')).toBeInTheDocument();
    expect(screen.getByText(/you win/i)).toBeInTheDocument();
    expect(screen.getByText(/decision/i)).toBeInTheDocument();
    expect(screen.getByText(/round 3/i)).toBeInTheDocument();
  });

  it('announces a player loss', () => {
    render(<OutcomeBanner outcome={{ winner: 'opponent', method: 'KO', round: 2 } as any} />);
    expect(screen.getByText(/you lose/i)).toBeInTheDocument();
  });

  it('renders an optional heading', () => {
    render(<OutcomeBanner heading="Title Defended" outcome={{ winner: 'player', method: 'KO', round: 1 } as any} />);
    expect(screen.getByText(/title defended/i)).toBeInTheDocument();
  });

  it('renders no action button', () => {
    render(<OutcomeBanner outcome={{ winner: 'player', method: 'decision', round: 3 } as any} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
