import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IntentPanel from './IntentPanel';
import type { StatLine } from '../domain';

const STATS: StatLine = {
  boxing: 82, kicks: 92, clinch: 80, takedowns: 98, submissions: 97,
  topControl: 88, cardio: 90, chin: 88, fightIQ: 78,
};

describe('IntentPanel', () => {
  it('renders all five intents', () => {
    render(<IntentPanel statLine={STATS} onIntent={() => {}} />);
    for (const intent of ['strike', 'clinch', 'takedown', 'submit', 'outpoint']) {
      expect(screen.getByTestId(`intent-${intent}`)).toBeInTheDocument();
    }
  });

  it('shows the strike offense stat values (boxing 82, kicks 92)', () => {
    render(<IntentPanel statLine={STATS} onIntent={() => {}} />);
    const strike = screen.getByTestId('intent-strike');
    expect(within(strike).getByText('82')).toBeInTheDocument();
    expect(within(strike).getByText('92')).toBeInTheDocument();
  });

  it('marks exactly the finish-capable intents (strike, clinch, submit) with a star', () => {
    render(<IntentPanel statLine={STATS} onIntent={() => {}} />);
    for (const intent of ['strike', 'clinch', 'submit']) {
      expect(within(screen.getByTestId(`intent-${intent}`)).getByText('★')).toBeInTheDocument();
    }
    for (const intent of ['takedown', 'outpoint']) {
      expect(within(screen.getByTestId(`intent-${intent}`)).queryByText('★')).not.toBeInTheDocument();
    }
  });

  it('exposes a screen-reader alternative for the finish marker', () => {
    render(<IntentPanel statLine={STATS} onIntent={() => {}} />);
    for (const intent of ['strike', 'clinch', 'submit']) {
      expect(within(screen.getByTestId(`intent-${intent}`)).getByText('Can finish')).toBeInTheDocument();
    }
    for (const intent of ['takedown', 'outpoint']) {
      expect(within(screen.getByTestId(`intent-${intent}`)).queryByText('Can finish')).not.toBeInTheDocument();
    }
  });

  it('calls onIntent with the clicked intent', async () => {
    const user = userEvent.setup();
    const onIntent = vi.fn();
    render(<IntentPanel statLine={STATS} onIntent={onIntent} />);
    await user.click(screen.getByTestId('intent-takedown'));
    expect(onIntent).toHaveBeenCalledWith('takedown');
  });

  it('does not fire when disabled', async () => {
    const user = userEvent.setup();
    const onIntent = vi.fn();
    render(<IntentPanel statLine={STATS} onIntent={onIntent} disabled />);
    await user.click(screen.getByTestId('intent-strike'));
    expect(onIntent).not.toHaveBeenCalled();
  });
});
