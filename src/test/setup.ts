import '@testing-library/jest-dom';
import { afterEach } from 'vitest';

// FightReplay uses window.matchMedia for reduced-motion. JSDOM does not implement it.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

afterEach(() => {
  try {
    localStorage.clear();
  } catch {
    // ignore environments without localStorage
  }
});
