import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DraftProgress from './DraftProgress';

describe('DraftProgress', () => {
  it('reports how many slots are filled', () => {
    render(<DraftProgress filled={4} total={9} />);
    expect(screen.getByText(/stat 4\/9 filled/i)).toBeInTheDocument();
  });
});
