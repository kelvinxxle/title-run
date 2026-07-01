import { describe, it, expect } from 'vitest';
import { SCREENS, DEFAULT_SCREEN, getScreen } from './screens';

describe('screen registry', () => {
  it('lists the four screens in order', () => {
    expect(SCREENS.map((s) => s.id)).toEqual([
      'championship-hub',
      'draft',
      'fight',
      'reward',
    ]);
  });

  it('defaults to the championship hub', () => {
    expect(DEFAULT_SCREEN).toBe('championship-hub');
  });

  it('resolves a screen by id', () => {
    expect(getScreen('draft').label).toBe('Draft');
  });
});
