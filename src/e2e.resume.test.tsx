import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import App from './App';
import { STORAGE_KEY } from './persistence/runStorage';

describe('park & resume (end to end)', () => {
  it('resumes to the exact state after an unmount/remount', () => {
    // ---- play: landing → draft → win fight 1 → reward → park at pre-fight fight 2 ----
    render(<App makeSeed={() => 'run-42'} />);
    fireEvent.click(screen.getByTestId('start-run'));
    for (let i = 0; i < 9; i++) fireEvent.click(screen.getByTestId('suggested-stat'));
    fireEvent.change(screen.getByLabelText(/fighter name/i), { target: { value: 'Kelvin' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm fighter/i }));
    fireEvent.click(screen.getByTestId('enter-fight'));
    fireEvent.click(screen.getByTestId('intent-strike'));
    fireEvent.click(screen.getByTestId('intent-strike'));
    fireEvent.click(screen.getByTestId('intent-strike'));
    fireEvent.click(screen.getByTestId('reward-type-bump'));
    fireEvent.click(screen.getByTestId('reward-stat-boxing'));
    fireEvent.click(screen.getByTestId('reward-confirm'));

    // parked at the hub, fight 2, with the win recorded
    expect(screen.getByTestId('run-status')).toHaveTextContent(/fight 2/i);
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(saved.run.phase).toBe('pre-fight');
    expect(saved.run.fightNumber).toBe(2);
    expect(saved.run.record.wins).toBe(1);

    // ---- close the app ----
    cleanup();
    expect(screen.queryByTestId('screen-championship-hub')).toBeNull();

    // ---- reopen: fresh mount hydrates from localStorage (makeSeed must NOT be used) ----
    render(<App makeSeed={() => { throw new Error('makeSeed should not run on resume'); }} />);
    expect(screen.getByTestId('screen-championship-hub')).toBeInTheDocument();
    expect(screen.getByTestId('run-status')).toHaveTextContent(/fight 2/i);
    expect(screen.getByTestId('enter-fight')).toBeInTheDocument();
  });
});
