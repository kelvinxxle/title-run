import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StatRow from './StatRow';

describe('StatRow', () => {
  it('renders label and value for an available stat and fires onSelect', async () => {
    const onSelect = vi.fn();
    render(<StatRow statId="boxing" value={82} state="available" onSelect={onSelect} />);
    expect(screen.getByText('Boxing')).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /keep boxing 82/i }));
    expect(onSelect).toHaveBeenCalledWith('boxing');
  });

  it('marks the suggested stat with a stable test id', () => {
    render(<StatRow statId="kicks" value={90} state="suggested" onSelect={() => {}} />);
    expect(screen.getByTestId('suggested-stat')).toBeInTheDocument();
  });

  it('renders a filled stat as non-interactive', () => {
    render(<StatRow statId="chin" value={70} state="filled" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('filled-stat-chin')).toBeInTheDocument();
  });
});
