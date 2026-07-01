import { describe, it, expect } from 'vitest';
import { colors, fonts } from './tokens';

describe('Octagon Elite design tokens', () => {
  it('exposes the core palette colors', () => {
    expect(colors.primary).toBe('#f2ca50');
    expect(colors.background).toBe('#0e0e0e');
    expect(colors.surface).toBe('#131313');
    expect(colors['secondary-container']).toBe('#960711');
  });

  it('exposes the typography families', () => {
    expect(fonts.display).toBe('Anton');
    expect(fonts.body).toBe('Archivo Narrow');
    expect(fonts.mono).toBe('Space Mono');
  });
});
