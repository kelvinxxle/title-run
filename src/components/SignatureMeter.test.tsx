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
});
