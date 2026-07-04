import { describe, it, expect, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DraftScreen from './DraftScreen';
import {
  startDraft, keepStat, nameFighter, getDraftedFighter, suggestedStatId, getFighter,
  type DraftState,
} from '../domain/combat';

// Deterministically replay the "always keep the suggested stat" policy in the domain,
// so UI assertions never hardcode a v2 roster/RNG detail.
function replay(seed: string, name: string) {
  let s: DraftState = startDraft(seed);
  for (let i = 0; i < 9; i++) s = keepStat(s, suggestedStatId(s)!);
  s = nameFighter(s, name);
  return getDraftedFighter(s);
}

describe('DraftScreen (v2)', () => {
  it('keeps the screen test id for navigation', () => {
    render(<DraftScreen seed="run-42" />);
    expect(screen.getByTestId('screen-draft')).toBeInTheDocument();
  });

  it('renders the first rolled fighter and 0/9 progress', () => {
    const first = getFighter(startDraft('run-42').current!.fighterId);
    render(<DraftScreen seed="run-42" />);
    expect(screen.getByRole('heading', { name: new RegExp(first.name, 'i') })).toBeInTheDocument();
    expect(screen.getByText(/stat 0\/9 filled/i)).toBeInTheDocument();
  });

  it('plays a full draft to a named, complete fighter matching the domain', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<DraftScreen seed="run-42" onComplete={onComplete} />);
    for (let i = 0; i < 9; i++) await user.click(screen.getByTestId('suggested-stat'));
    await user.type(screen.getByLabelText(/fighter name/i), 'The Chosen One');
    await user.click(screen.getByRole('button', { name: /confirm fighter/i }));

    const expected = replay('run-42', 'The Chosen One');
    expect(screen.getByTestId('fighter-name')).toHaveTextContent('The Chosen One');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toMatchObject({ name: 'The Chosen One', statLine: expected.statLine });
  });

  // Rendered under <StrictMode> to exercise render/initializer double-invocation
  // (render purity) and stay forward-compatible. NOTE: React 18.3.1 does NOT
  // double-invoke event-triggered setState updaters, so this test cannot go RED
  // on a call count if the onComplete side-effect is moved back INTO the setState
  // updater. The regression guard is structural: DraftScreen keeps that side-effect
  // OUT of the updater (in the handler body), which is the correct React pattern.
  it('calls onComplete once with the drafted fighter after naming', () => {
    const onComplete = vi.fn();
    render(<StrictMode><DraftScreen seed="run-42" onComplete={onComplete} /></StrictMode>);
    for (let i = 0; i < 9; i++) fireEvent.click(screen.getByTestId('suggested-stat'));
    fireEvent.change(screen.getByLabelText(/fighter name/i), { target: { value: 'Kelvin' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm fighter/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toMatchObject({ name: 'Kelvin' });
  });
});
