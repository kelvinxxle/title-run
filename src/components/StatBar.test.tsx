import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatBar from './StatBar';

describe('StatBar', () => {
  it('renders an accessible meter with the value', () => {
    render(<StatBar value={82} />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuenow', '82');
    expect(meter).toHaveAttribute('aria-valuemin', '1');
    expect(meter).toHaveAttribute('aria-valuemax', '99');
  });
});
