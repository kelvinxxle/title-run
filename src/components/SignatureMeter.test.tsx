import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SignatureMeter from './SignatureMeter';

describe('SignatureMeter', () => {
  it('M17 T8 RED: renders signature-meter testid', () => {
    render(<SignatureMeter charge={0} />);
    expect(screen.getByTestId('signature-meter')).toBeInTheDocument();
  });

  it('M17 T8 RED: shows SIGNATURE label', () => {
    render(<SignatureMeter charge={50} />);
    expect(screen.getByText(/signature/i)).toBeInTheDocument();
  });

  it('M17 T8 RED: full charge applies a visually distinct glow class', () => {
    const { container } = render(<SignatureMeter charge={100} />);
    expect(container.innerHTML).toMatch(/ready|glow|primary/i);
  });

  it('FIX F RED: has role="meter" for accessibility', () => {
    render(<SignatureMeter charge={60} />);
    expect(screen.getByRole('meter')).toBeInTheDocument();
  });

  it('FIX F RED: has aria-valuemin, aria-valuemax, and aria-valuenow attributes', () => {
    render(<SignatureMeter charge={60} />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '100');
    expect(meter).toHaveAttribute('aria-valuenow', '60');
  });

  it('FIX F RED: has an accessible label', () => {
    render(<SignatureMeter charge={50} />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveAccessibleName();
  });
});
