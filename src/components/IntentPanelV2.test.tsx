import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import IntentPanelV2 from './IntentPanelV2';
import type { StatLine } from '../domain/combat';

const LINE: StatLine = { striking:70, strikingDef:60, takedowns:55, takedownDef:50, submissions:40, submissionDef:45, cardio:65, chin:60, fightIQ:58 };

describe('IntentPanelV2', () => {
  it('defaults to a strike at head with the pick-apart tactic and commits that intent', () => {
    const onCommit = vi.fn();
    render(<IntentPanelV2 statLine={LINE} onCommit={onCommit} />);
    fireEvent.click(screen.getByTestId('intent-commit'));
    expect(onCommit).toHaveBeenCalledWith({ kind:'strike', target:'head', tactic:'pickApart' });
  });

  it('reflects target and tactic selections in the committed strike', () => {
    const onCommit = vi.fn();
    render(<IntentPanelV2 statLine={LINE} onCommit={onCommit} />);
    fireEvent.click(screen.getByTestId('target-body'));
    fireEvent.click(screen.getByTestId('tactic-pressure'));
    fireEvent.click(screen.getByTestId('intent-commit'));
    expect(onCommit).toHaveBeenCalledWith({ kind:'strike', target:'body', tactic:'pressure' });
  });

  it('wrestle commits a plain takedown intent (no striking vocabulary)', () => {
    const onCommit = vi.fn();
    render(<IntentPanelV2 statLine={LINE} onCommit={onCommit} />);
    fireEvent.click(screen.getByTestId('kind-wrestle'));
    // striking-only controls are gone while wrestling
    expect(screen.queryByTestId('target-head')).toBeNull();
    expect(screen.queryByTestId('tactic-pressure')).toBeNull();
    fireEvent.click(screen.getByTestId('intent-commit'));
    expect(onCommit).toHaveBeenCalledWith({ kind:'wrestle' });
  });

  it('does not commit when disabled', () => {
    const onCommit = vi.fn();
    render(<IntentPanelV2 statLine={LINE} onCommit={onCommit} disabled />);
    fireEvent.click(screen.getByTestId('intent-commit'));
    expect(onCommit).not.toHaveBeenCalled();
  });
});
