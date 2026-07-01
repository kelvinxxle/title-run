import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FighterHealthCard from './FighterHealthCard';

describe('FighterHealthCard', () => {
  it('renders name, subtitle, badge and an accessible health meter', () => {
    render(
      <FighterHealthCard
        side="opponent"
        name='Hideo "Granite" Stone'
        subtitle="GRAPPLER · CHALLENGER"
        badge="DANGER"
        healthPct={0.5}
        read="Wants it on the mat."
      />,
    );
    expect(screen.getByText('Hideo "Granite" Stone')).toBeInTheDocument();
    expect(screen.getByText('GRAPPLER · CHALLENGER')).toBeInTheDocument();
    expect(screen.getByText('DANGER')).toBeInTheDocument();
    expect(screen.getByText('Wants it on the mat.')).toBeInTheDocument();
    const meter = screen.getByRole('meter', { name: /granite.*stone health/i });
    expect(meter).toHaveAttribute('aria-valuenow', '50');
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '100');
  });

  it('rounds full health to 100 and omits the read when not given', () => {
    render(
      <FighterHealthCard side="player" name="Ace" subtitle="YOU" badge="YOU" healthPct={1} />,
    );
    expect(screen.getByRole('meter', { name: /ace health/i })).toHaveAttribute('aria-valuenow', '100');
  });
});
