/**
 * Repo-wide guard: every Tailwind motion utility in non-test source files
 * must carry a `motion-safe:` prefix so that `prefers-reduced-motion: reduce`
 * suppresses all animation globally.
 *
 * To add a legitimate exception, append the repo-relative file path to
 * ALLOWED_EXCEPTIONS with an inline comment explaining why.
 */
import { describe, it, expect } from 'vitest';

// No exceptions yet. Add glob-matched paths with an explanatory comment.
const ALLOWED_EXCEPTIONS: string[] = [];

// Eagerly import every non-test .ts/.tsx source file under src/ as raw text.
// Negation patterns exclude test files (*.test.ts / *.test.tsx).
const rawFiles = import.meta.glob<string>(
  ['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'],
  { query: '?raw', import: 'default', eager: true },
);

// Negative lookbehind: matches only when NOT preceded by "motion-safe:"
// animate-(?!none\b): excludes animate-none (disables animation — safe unguarded)
const BARE_ANIMATE = /(?<!motion-safe:)animate-(?!none\b)/;
// transition-(?!none\b): excludes transition-none (disables transition — safe unguarded)
const BARE_TRANSITION = /(?<!motion-safe:)transition-(?!none\b)/;
// duration-\d: all numeric duration utilities must be gated
const BARE_DURATION = /(?<!motion-safe:)duration-\d/;

describe('repo-wide motion-safe guard', () => {
  it('every motion utility in source files must carry a motion-safe: prefix', () => {
    const violations: string[] = [];

    for (const [path, content] of Object.entries(rawFiles)) {
      if (ALLOWED_EXCEPTIONS.some((ex) => path.includes(ex))) continue;
      if (BARE_ANIMATE.test(content)) violations.push(`${path}: bare animate-*`);
      if (BARE_TRANSITION.test(content)) violations.push(`${path}: bare transition-*`);
      if (BARE_DURATION.test(content)) violations.push(`${path}: bare duration-*`);
    }

    expect(
      violations,
      `\nFiles with unguarded motion utilities (add motion-safe: prefix or add to ALLOWED_EXCEPTIONS):\n${violations.join('\n')}`,
    ).toHaveLength(0);
  });
});

