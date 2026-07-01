import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NameFighterForm from './NameFighterForm';

describe('NameFighterForm', () => {
  it('disables submit until a non-empty name is entered', async () => {
    const onSubmit = vi.fn();
    render(<NameFighterForm onSubmit={onSubmit} />);
    const button = screen.getByRole('button', { name: /confirm fighter/i });
    expect(button).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/fighter name/i), 'Iron Mike');
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onSubmit).toHaveBeenCalledWith('Iron Mike');
  });
});
