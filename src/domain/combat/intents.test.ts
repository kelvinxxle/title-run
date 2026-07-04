import { describe, it, expect } from 'vitest';
import {
  STRIKE_TACTICS, GROUND_PLANS, TARGETS,
  KIND_LABELS, STRIKE_TACTIC_LABELS, GROUND_PLAN_LABELS, TARGET_LABELS,
  isStrike, intentPhase,
  type RoundIntent,
} from './intents';

describe('round intents', () => {
  it('offers 3 strike tactics, 2 ground plans, 2 targets', () => {
    expect(STRIKE_TACTICS).toEqual(['pressure','counter','pickApart']);
    expect(GROUND_PLANS).toEqual(['ground-and-pound','submission']);
    expect(TARGETS).toEqual(['head','body']);
  });

  it('maps each intent to its phase', () => {
    expect(intentPhase({ kind:'strike', target:'head', tactic:'pressure' })).toBe('strike');
    expect(intentPhase({ kind:'wrestle' })).toBe('wrestle');
  });

  it('isStrike narrows the union to the strike variant', () => {
    const strike: RoundIntent = { kind:'strike', target:'body', tactic:'counter' };
    const wrestle: RoundIntent = { kind:'wrestle' };
    expect(isStrike(strike)).toBe(true);
    expect(isStrike(wrestle)).toBe(false);
    if (isStrike(strike)) {
      expect(strike.target).toBe('body');
      expect(strike.tactic).toBe('counter');
    }
  });

  it('labels every choice for the UI', () => {
    expect(KIND_LABELS.strike).toBeTruthy();
    expect(KIND_LABELS.wrestle).toBeTruthy();
    for (const t of STRIKE_TACTICS) expect(STRIKE_TACTIC_LABELS[t]).toBeTruthy();
    for (const g of GROUND_PLANS) expect(GROUND_PLAN_LABELS[g]).toBeTruthy();
    for (const t of TARGETS) expect(TARGET_LABELS[t]).toBeTruthy();
  });
});
