import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// M19-A ships the fight-presentation engine DORMANT: the rejected renderer must
// not be mounted in the live fight screen, and the dev replay lab must not exist
// as a routable screen. These guards fail loudly if a future edit re-mounts it.

const read = (p: string) => readFileSync(p, 'utf8');

describe('M19-A dormancy', () => {
  it('FightView does not import or mount FightReplay', () => {
    const src = read('src/screens/FightView.tsx');
    expect(src).not.toMatch(/FightReplay/);
  });

  it('App does not reference a ReplayLab route', () => {
    const src = read('src/App.tsx');
    expect(src).not.toMatch(/ReplayLab|lab.*===.*'1'/);
  });
});
