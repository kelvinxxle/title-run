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
        bodyPct={0.7}
        staminaPct={0.8}
        headStateLabel="fresh"
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
      <FighterHealthCard side="player" name="Ace" subtitle="YOU" badge="YOU" healthPct={1} bodyPct={1} staminaPct={1} headStateLabel="fresh" />,
    );
    expect(screen.getByRole('meter', { name: /ace health/i })).toHaveAttribute('aria-valuenow', '100');
  });

  it('renders fighter-avatar when avatarSeed and archetype are provided', () => {
    render(
      <FighterHealthCard side="player" name="Ace" subtitle="YOU" badge="YOU" healthPct={1} bodyPct={1} staminaPct={1} headStateLabel="fresh" avatarSeed="Ace" archetype="striker" />,
    );
    expect(screen.getByTestId('fighter-avatar')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ace portrait' })).toBeInTheDocument();
  });

  it('does not render fighter-avatar when avatar props are absent', () => {
    render(
      <FighterHealthCard side="player" name="Ace" subtitle="YOU" badge="YOU" healthPct={1} bodyPct={1} staminaPct={1} headStateLabel="fresh" />,
    );
    expect(screen.queryByTestId('fighter-avatar')).toBeNull();
  });
});

describe('M14: three-meter card', () => {
  const baseProps = {
    side: 'player' as const,
    name: 'Test Fighter',
    subtitle: 'Stamina 80%',
    badge: 'YOU',
    healthPct: 0.8,
    bodyPct: 0.6,
    staminaPct: 0.75,
    headStateLabel: 'fresh' as const,
  };

  it('renders body meter with correct aria-valuenow', () => {
    const { container } = render(<FighterHealthCard {...baseProps} />);
    const bodyMeter = container.querySelector('[data-testid="meter-body-player"]');
    expect(bodyMeter).toBeTruthy();
    expect(bodyMeter?.getAttribute('aria-valuenow')).toBe('60');
  });

  it('renders gas meter with correct aria-valuenow', () => {
    const { container } = render(<FighterHealthCard {...baseProps} />);
    const gasMeter = container.querySelector('[data-testid="meter-gas-player"]');
    expect(gasMeter).toBeTruthy();
    expect(gasMeter?.getAttribute('aria-valuenow')).toBe('75');
  });

  it('sets data-head-state="rocked" when headStateLabel is rocked', () => {
    const { container } = render(<FighterHealthCard {...baseProps} headStateLabel="rocked" />);
    const card = container.querySelector('[data-testid="fighter-card-player"]');
    expect(card?.getAttribute('data-head-state')).toBe('rocked');
  });

  it('shows damage flash badge when damageFlash.head > 0', () => {
    const { container } = render(
      <FighterHealthCard {...baseProps} damageFlash={{ head: 12, body: 0 }} />,
    );
    const badge = container.querySelector('[data-testid="dmg-player-head"]');
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toContain('12');
  });

  it('preserves existing head meter aria-label', () => {
    const { getByRole } = render(<FighterHealthCard {...baseProps} />);
    expect(getByRole('meter', { name: 'Test Fighter health' })).toBeTruthy();
  });
});
