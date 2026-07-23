import { describe, it, expect } from 'vitest';
import css from './arena-idle.css?raw';

describe('arena-idle.css', () => {
  it('contains .arena-idle .rig-bob rule', () => {
    expect(css).toMatch(/\.arena-idle\s+\.rig-bob/);
  });

  it('contains @keyframes rig-bob (or rigBob)', () => {
    expect(css).toMatch(/@keyframes\s+rig(-bob|Bob)/);
  });

  it('contains prefers-reduced-motion media query', () => {
    expect(css).toContain('prefers-reduced-motion');
  });

  it('does not contain JavaScript timing or randomness calls', () => {
    expect(css).not.toContain('Math.random');
    expect(css).not.toContain('Date.now');
    expect(css).not.toContain('setInterval');
    expect(css).not.toContain('setTimeout');
  });
});
