# Title Run

A single-player MMA game. You build a fighter by taking one stat at a time from real UFC fighters, then run an escalating ladder of opponents to win the belt and defend it. Your score is the number of defenses you survive.

Play it at https://kelvinxxle.github.io/title-run/

## How a run works

**Draft.** The game rolls a fighter from a roster of 40 and shows their stat line. You keep one stat into its matching slot, then it rolls someone new. There are nine slots: striking, striking defense, takedowns, takedown defense, submissions, submission defense, cardio, chin, and fight IQ. A fighter you have already seen never rolls again, so the pool shrinks as you go and every keep throws away the other eight stats on offer.

**Fight.** Rounds run three exchanges each. On every exchange you pick a strike, shoot a takedown, or fire your signature. Six strikes cover head, body, and legs, and each trades damage against exposure. A power punch hits hardest and leaves you open. A jab is safe and scores. Landing a takedown moves the fight to the ground, where you climb a position ladder from guard to half guard to side control to mount to back. Each position opens a different submission. Between rounds your corner offers four game plans that trade stamina against damage.

**Signature.** Winning an exchange adds 18 to a charge meter plus a share of how one-sided the beat was. At 100 you can fire a signature strike, which carries a higher attack multiplier than any normal strike and empties the meter. Which signature you get depends on the fighter whose striking you drafted.

**Title.** Fight 5 is for the belt and runs five rounds instead of three. Win it and every fight after that is a defense. One loss ends the run. The game keeps your longest reign in local storage.

## Running it locally

Node 20, matching CI and the deploy workflow.

```bash
npm install
npm run dev
```

Other commands:

```bash
npm test          # vitest: 581 tests across 70 files
npm run typecheck # tsc --noEmit
npm run build     # tsc -b && vite build
npm run preview   # serve the production build
```

CI runs typecheck, tests, and the build on every pull request to main. A push to main builds and deploys to GitHub Pages.

## How the simulation stays deterministic

Every random decision derives its own generator from a composed key instead of drawing from one shared stream:

```ts
const rng = createRng(`${state.seed}#f${state.fightNumber}#r${state.round}#x${state.exchange}`);
```

`createRng` hashes that string with xmur3 and seeds a mulberry32 generator. Opponent AI, exchange resolution, ground scrambles, finish windows, and the draft each build their own key from the run seed.

Each key names a position in the fight, so call order stops mattering. Nothing holds a cursor that can drift, and adding a call site in one part of the engine cannot shift results anywhere else. A given seed produces the same draft rolls, the same opponent ladder, and the same fight outcomes every time.

The opponent ladder works the same way. The roster sorts by average stat and splits into five tiers of eight. Fights 1 through 4 draw one fighter from tiers 1 through 4, so nobody repeats on the way up. From fight 5 the game shuffles tier 5 with a seeded permutation and walks it, cycling all eight champions before any rematch.

The opponent also reads you. It scans your last three logged moves for head-hunting power strikes and raises its counter chance from that, scaled by its fight IQ. It reads the log before the current beat is written, so it never sees the move it is reacting to.

## How the fight animates

The engine and the animation are separate. Resolving an exchange appends a `ResolvedBeat` to the fight state: who acted, which move, whether it landed, which target, the damage deltas, and whether it ended the fight.

`buildBeatTimeline` reads one beat and returns timed events such as windup, strike, impact, flash, hitstop, and reaction, each with a start time and a duration. `useBeatPlayback` walks that list against `requestAnimationFrame` and hands poses and flash flags to the arena.

Two useful things fall out of the split. Hitstop works because the hook advances a game clock that freezes during hitstop events while wall time keeps running, so an impact can hold without desyncing the rest of the timeline. And when `prefers-reduced-motion` is set, the hook skips the frame loop and snaps straight to the final pose, dropping the animation without touching the result.

Beats are derived data, so storage strips them on save and resets them to an empty array on load. A saved run carries the fight, not its presentation.

## Saved runs

State persists to local storage under `title-run:v2` at schema version 6. Loading validates the whole shape, including invariants that tie a fight phase to its payload. A finish window must carry a window and no outcome. A finished fight must carry an outcome and no window. Anything that fails validation or carries an older version gets cleared instead of loaded, so a stale save cannot crash the app. A run parked mid fight resumes on the same round, exchange, damage, and stamina.

## Stack

React 18 and TypeScript on Vite 5, styled with Tailwind. React and React DOM are the only runtime dependencies. Tests run on Vitest with jsdom and Testing Library.

Roughly 5,500 lines of source against 6,300 lines of test.

## Layout

```
src/domain/combat/   fight engine: draft, roster, strikes, ground, signatures, judges
src/domain/rng.ts    seeded generator
src/replay/          beats to timed animation events, playback hook
src/screens/         draft, fight, championship hub
src/components/      HUD, panels, fighter rendering
src/persistence/     versioned local storage
docs/                product spec and design references
```

Fighter photos live in `public/fighters`, with sourcing in `public/fighters/CREDITS.md`.
