import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import IntentPanelV2 from './IntentPanelV2';
import type { StatLine } from '../domain/combat';

const LINE: StatLine = { striking:70, strikingDef:60, takedowns:55, takedownDef:50, submissions:40, submissionDef:45, cardio:65, chin:60, fightIQ:58 };

describe('IntentPanelV2', () => {
  it('defaults to strike/head/technical and commits that intent', () => {
    const onCommit = vi.fn();
    render(<IntentPanelV2 statLine={LINE} onCommit={onCommit} />);
    fireEvent.click(screen.getByTestId('intent-commit'));
    expect(onCommit).toHaveBeenCalledWith({ where:'strike', target:'head', approach:'technical' });
  });

  it('reflects axis selections in the committed intent', () => {
    const onCommit = vi.fn();
    render(<IntentPanelV2 statLine={LINE} onCommit={onCommit} />);
    fireEvent.click(screen.getByTestId('where-grapple'));
    fireEvent.click(screen.getByTestId('target-body'));
    fireEvent.click(screen.getByTestId('approach-pressure'));
    fireEvent.click(screen.getByTestId('intent-commit'));
    expect(onCommit).toHaveBeenCalledWith({ where:'grapple', target:'body', approach:'pressure' });
  });

  it('does not commit when disabled', () => {
    const onCommit = vi.fn();
    render(<IntentPanelV2 statLine={LINE} onCommit={onCommit} disabled />);
    fireEvent.click(screen.getByTestId('intent-commit'));
    expect(onCommit).not.toHaveBeenCalled();
  });
});
