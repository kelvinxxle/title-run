import { describe, it, expect } from 'vitest';
import {
  POSITION_LADDER, POSITION_QUALITY, nextPosition, POSITION_SUBMISSION,
  GROUND_ACTIONS,
} from './ground';

describe('ground position model', () => {
  it('ladder is guard→half-guard→side-control→mount→back, quality strictly increasing', () => {
    expect(POSITION_LADDER).toEqual(['guard', 'half-guard', 'side-control', 'mount', 'back']);
    for (let i = 1; i < POSITION_LADDER.length; i++) {
      expect(POSITION_QUALITY[POSITION_LADDER[i]]).toBeGreaterThan(POSITION_QUALITY[POSITION_LADDER[i - 1]]);
    }
    expect(POSITION_QUALITY.guard).toBe(0);
    expect(POSITION_QUALITY.back).toBe(4);
  });

  it('nextPosition walks the ladder and dead-ends at back', () => {
    expect(nextPosition('guard')).toBe('half-guard');
    expect(nextPosition('side-control')).toBe('mount');
    expect(nextPosition('mount')).toBe('back');
    expect(nextPosition('back')).toBeNull();
  });

  it('submissions are gated by position: guard has none, back gives the RNC', () => {
    expect(POSITION_SUBMISSION.guard).toBeNull();
    expect(POSITION_SUBMISSION['half-guard']).toBe('kimura');
    expect(POSITION_SUBMISSION['side-control']).toBe('arm-triangle');
    expect(POSITION_SUBMISSION.mount).toBe('armbar');
    expect(POSITION_SUBMISSION.back).toBe('rear-naked-choke');
  });

  it('exposes the three ground actions', () => {
    expect(GROUND_ACTIONS).toEqual(['ground-and-pound', 'advance', 'submission']);
  });
});
