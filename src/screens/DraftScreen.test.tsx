import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DraftScreen from './DraftScreen';

describe('DraftScreen', () => {
  it('keeps the screen test id for navigation', () => {
    render(<DraftScreen seed="run-42" />);
    expect(screen.getByTestId('screen-draft')).toBeInTheDocument();
  });

  it('plays a full draft to a named, complete fighter', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<DraftScreen seed="run-42" onComplete={onComplete} />);

    expect(screen.getByRole('heading', { name: /charles oliveira/i })).toBeInTheDocument();
    expect(screen.getByText(/stat 0\/9 filled/i)).toBeInTheDocument();

    for (let i = 0; i < 9; i++) {
      await user.click(screen.getByTestId('suggested-stat'));
    }

    const input = screen.getByLabelText(/fighter name/i);
    await user.type(input, 'The Chosen One');
    await user.click(screen.getByRole('button', { name: /confirm fighter/i }));

    expect(screen.getByTestId('fighter-name')).toHaveTextContent('The Chosen One');
    expect(screen.getByText('98')).toBeInTheDocument();
    expect(screen.getByText('97')).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0].name).toBe('The Chosen One');
  });

  it('calls onComplete once with the drafted fighter after naming', () => {
    const onComplete = vi.fn();
    render(<DraftScreen seed="run-42" onComplete={onComplete} />);
    // keep the suggested stat 9 times
    for (let i = 0; i < 9; i++) {
      fireEvent.click(screen.getByTestId('suggested-stat'));
    }
    fireEvent.change(screen.getByLabelText(/fighter name/i), { target: { value: 'Kelvin' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm fighter/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toMatchObject({ name: 'Kelvin' });
  });
});
