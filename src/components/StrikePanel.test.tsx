import { render, screen, fireEvent } from '@testing-library/react';
import StrikePanel from './StrikePanel';

const P = {
  striking: 80, strikingDef: 70, takedowns: 40, takedownDef: 80,
  submissions: 40, submissionDef: 70, cardio: 75, chin: 70, fightIQ: 80,
};

it('renders all six strikes + takedown and shows the exchange count', () => {
  render(<StrikePanel statLine={P as any} exchange={2} exchangesPerRound={3} onMove={() => {}} />);
  expect(screen.getByTestId('strike-jab')).toBeInTheDocument();
  expect(screen.getByTestId('strike-powerPunch')).toBeInTheDocument();
  expect(screen.getByTestId('strike-elbow')).toBeInTheDocument();
  expect(screen.getByTestId('strike-takedown')).toBeInTheDocument();
  expect(screen.getByText(/exchange 2 of 3/i)).toBeInTheDocument();
});

it('emits the strike move on tap', () => {
  const onMove = vi.fn();
  render(<StrikePanel statLine={P as any} exchange={1} exchangesPerRound={3} onMove={onMove} />);
  fireEvent.click(screen.getByTestId('strike-powerPunch'));
  expect(onMove).toHaveBeenCalledWith({ kind: 'strike', strike: 'powerPunch' });
});

it('emits the takedown move on tap', () => {
  const onMove = vi.fn();
  render(<StrikePanel statLine={P as any} exchange={1} exchangesPerRound={3} onMove={onMove} />);
  fireEvent.click(screen.getByTestId('strike-takedown'));
  expect(onMove).toHaveBeenCalledWith({ kind: 'takedown' });
});
