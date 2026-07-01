import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

describe('App run loop', () => {
  it('landing → draft → pre-fight → fight → reward → next fight', () => {
    render(<App makeSeed={() => 'run-42'} />);

    // landing
    fireEvent.click(screen.getByTestId('start-run'));

    // draft: keep suggested 9x, then name
    for (let i = 0; i < 9; i++) fireEvent.click(screen.getByTestId('suggested-stat'));
    fireEvent.change(screen.getByLabelText(/fighter name/i), { target: { value: 'Kelvin' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm fighter/i }));

    // pre-fight hub → enter octagon
    expect(screen.getByTestId('screen-championship-hub')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('enter-fight'));

    // fight: strike x3 => decision win round 3 (seeded run-42 fight 1)
    fireEvent.click(screen.getByTestId('intent-strike'));
    fireEvent.click(screen.getByTestId('intent-strike'));
    fireEvent.click(screen.getByTestId('intent-strike'));

    // reward: bump boxing, confirm
    expect(screen.getByTestId('screen-reward')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('reward-type-bump'));
    fireEvent.click(screen.getByTestId('reward-stat-boxing'));
    fireEvent.click(screen.getByTestId('reward-confirm'));

    // back at the hub, now fight 2
    expect(screen.getByTestId('screen-championship-hub')).toBeInTheDocument();
    expect(screen.getByTestId('run-status')).toHaveTextContent(/fight 2/i);
  });
});

