import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StrikePanel from './StrikePanel';

const P = {
  striking: 80, strikingDef: 70, takedowns: 40, takedownDef: 80,
  submissions: 40, submissionDef: 70, cardio: 75, chin: 70, fightIQ: 80,
};

describe('StrikePanel', () => {
  it('renders all six strikes and shows the exchange count', () => {
    render(<StrikePanel statLine={P as any} exchange={2} exchangesPerRound={3} onMove={() => {}} />);
    expect(screen.getByTestId('strike-jab')).toBeInTheDocument();
    expect(screen.getByTestId('strike-powerPunch')).toBeInTheDocument();
    expect(screen.getByTestId('strike-elbow')).toBeInTheDocument();
    expect(screen.getByText(/exchange 2 of 3/i)).toBeInTheDocument();
  });

  it('emits the strike move on tap', () => {
    const onMove = vi.fn();
    render(<StrikePanel statLine={P as any} exchange={1} exchangesPerRound={3} onMove={onMove} />);
    fireEvent.click(screen.getByTestId('strike-powerPunch'));
    expect(onMove).toHaveBeenCalledWith({ kind: 'strike', strike: 'powerPunch' });
  });

  it('renders a takedown type for each of the four shots and emits the chosen type', () => {
    const onMove = vi.fn();
    render(<StrikePanel statLine={P as any} exchange={1} exchangesPerRound={3} onMove={onMove} />);
    fireEvent.click(screen.getByTestId('takedown-single-leg'));
    expect(onMove).toHaveBeenCalledWith({ kind: 'takedown', takedownType: 'single-leg' });
    fireEvent.click(screen.getByTestId('takedown-body-lock'));
    expect(onMove).toHaveBeenCalledWith({ kind: 'takedown', takedownType: 'body-lock' });
  });

  // ── M17 T8: Signature button ────────────────────────────────────────────────

  it('M17 T8 RED: does NOT render the signature button when sigReady=false', () => {
    render(<StrikePanel statLine={P as any} exchange={1} exchangesPerRound={3} onMove={() => {}} signatureCharge={50} sigReady={false} />);
    expect(screen.queryByTestId('strike-signature')).not.toBeInTheDocument();
  });

  it('M17 T8 RED: renders strike-signature button when sigReady=true', () => {
    const onMove = vi.fn();
    render(<StrikePanel statLine={P as any} exchange={1} exchangesPerRound={3} onMove={onMove} signatureCharge={100} sigReady={true} />);
    expect(screen.getByTestId('strike-signature')).toBeInTheDocument();
  });

  it('M17 T8 RED: emits { kind: signature } when signature button is clicked', () => {
    const onMove = vi.fn();
    render(<StrikePanel statLine={P as any} exchange={1} exchangesPerRound={3} onMove={onMove} signatureCharge={100} sigReady={true} />);
    fireEvent.click(screen.getByTestId('strike-signature'));
    expect(onMove).toHaveBeenCalledWith({ kind: 'signature' });
  });
});
