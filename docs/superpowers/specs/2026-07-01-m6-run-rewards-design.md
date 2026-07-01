# M6 — Run, Streak & Rewards (Design Spec)

**Milestone:** M6 of 7 · **Status:** approved design, ready for implementation plan
**Date:** 2026-07-01
**Depends on (merged):** M1 foundation, M2 stats/roster, M3 draft machine + DraftScreen, M4 fight engine, M5 Fight UI
**Base:** `origin/main` @ `184a827` (post-M5)

---

## 1. Why we're building this

M1–M5 delivered every *piece* of the game — a draft machine, a deterministic fight engine, and
a playable single fight — but they are not connected. `FightScreen` fights a **baked demo
fighter**, "New Fight" just increments a counter, and there is no draft→fight link, no reward,
no permadeath, and no scoring. The Reward and Championship Hub screens are "coming soon"
placeholders, and `App` is a flat dev bottom-nav between four independent screens.

**M6 is the run layer** that turns the pieces into the actual roguelike loop the product spec
describes (§3 Reward, §4 Streak & end state): draft your fighter, fight an escalating streak,
pick one reward after each win, win the belt at fight 5, defend it, and lose the run on the
first defeat — with **reign length (title defenses) as the headline score.**

## 2. Goals

- A player can complete a **full run end-to-end**: draft → climb → win the belt → defend →
  lose → start a new run, entirely from the UI, with no dev navigation.
- The run is a **pure, serializable state machine** so M7 can persist it (autosave/park-resume)
  with near-zero rework.
- The real **drafted fighter** flows into fights; **damage carries** between fights; **rewards**
  change the fighter between fights.
- Every decision keeps the game's DNA: **small, meaningful choices** with specific
  "what changed" feedback.

## 3. Scope

### In scope (M6)
1. **`src/domain/run.ts`** — pure run state machine (types + transitions), serializable.
2. **Reward model** — three reward types (bump / re-roll / recover), player-chosen target,
   applied to the run's fighter/damage.
3. **Reign scoring** — champion status + successful title defenses (the headline score).
4. **Championship Hub screen** — real, controlled; the home base between every fight.
5. **Reward screen** — real, controlled; two-step pick with what-changed feedback.
6. **Controller wiring** — `App` renders by `run.phase`; `DraftScreen.onComplete` and
   `FightScreen` become controlled; `BottomNavBar` removed from the flow; `TopAppBar` shows a
   compact run-status readout.
7. **Fold carryover nits** (see §9).

### Out of scope (deferred to M7)
- localStorage autosave / park & resume to exact state.
- **Best-reign** storage and the celebrated "new record!" end-of-run flourish.
- Broader "what changed" polish, sound, and any end-of-run summary beyond the minimal one.
- Mid-draft resume persistence (leave a clean seam; draft state stays inside DraftScreen for now).

## 4. The run state machine (`src/domain/run.ts`)

Pure functions over a single serializable `RunState`. No React, no randomness outside the
seeded RNG, no `Date.now()` inside the domain.

### Phases
`RunPhase = 'drafting' | 'pre-fight' | 'fighting' | 'reward' | 'run-over'`

`App` holds `run: RunState | null`. **`null` = landing** (no active run → Hub shows "Start New Run").

### `RunState` (serializable)

| Field | Type | Meaning |
|---|---|---|
| `seed` | `string` | one seed per run; all fights, opponents, and reward rolls derive from it |
| `phase` | `RunPhase` | which screen the controller shows |
| `fighter` | `{ name: string; statLine: StatLine } \| null` | the drafted fighter; **rewards mutate this** |
| `fightNumber` | `number` | 1-based; the current/next bout |
| `carriedDamage` | `number` | damage carried into the next fight (0 at run start) |
| `record` | `{ wins: number; losses: number }` | `losses` is 0 or 1 (permadeath) |
| `isChampion` | `boolean` | true once fight 5 is won |
| `defenses` | `number` | **reign length = successful title defenses → headline score** |
| `fight` | `FightState \| null` | the active fight while `phase === 'fighting'`, else `null` |

### Transitions (pure)

- `startRun(seed): RunState` → `phase='drafting'`, empty fighter, `fightNumber=1`, zeroed
  record/damage/defenses.
- `applyDraft(run, draftedFighter): RunState` → stores fighter, `phase='pre-fight'`.
- `startNextFight(run): RunState` → calls `startFight({ seed, fightNumber, playerStatLine:
  fighter.statLine, carryInDamage: carriedDamage })`, stores it in `fight`, `phase='fighting'`.
- `settleFight(run, fightState): RunState` → reads the settled `FightState`:
  - **loss** → `record.losses=1`, `phase='run-over'`.
  - **win** → `record.wins+=1`; update champion/reign per §5; `carriedDamage =
    carryOutDamage(fightState)`; `phase='reward'`.
- `applyReward(run, reward): RunState` → mutates `fighter.statLine` or lowers `carriedDamage`
  per §6, advances `fightNumber+=1`, `phase='pre-fight'`.

*(Screens call these via controller callbacks; the domain never imports React.)*

## 5. Champion & reign rules

The engine's `roundsForFight(n)` already returns **3 rounds for fights 1–4** and **5 rounds for
fight 5+**, matching the product spec — the run layer just drives `fightNumber`.

- Win fights **1–4** → the climb continues, not yet champion.
- Win **fight 5** → `isChampion = true`, `defenses = 0` (you take the vacant belt).
- Win **fight 6+** → `defenses += 1` (each win is a successful defense).
- **Any loss** → `phase = 'run-over'` (permadeath; first loss ends the run).

**Headline score = `defenses`** (reign length). `record.wins` is secondary.

## 6. Reward system

After **every win**, the Reward screen offers all **three** types; the player picks one via a
**two-step** flow (type → target). Magnitudes are named constants (product spec defers exact
tuning); starting values below.

| Reward | Target | Effect | Default (tunable) |
|---|---|---|---|
| **Bump** | choose any stat | raise it, clamped to `STAT_MAX` (99) | **+8** |
| **Re-roll** (gamble) | choose a stat | roll a fresh random fighter and take **their** value for that slot (reuses the draft mechanic; drawn from the run seed) — may be higher or lower | replaces old value |
| **Recover** | none | reduce `carriedDamage` | **heal 50% of max durability**, floored at 0 |

- **Bump → Chin** also raises max durability (engine's `durability()` keys off Chin) — an
  emergent trade-off, free from the engine.
- **Recover** is **offered but disabled when `carriedDamage === 0`** (nudges toward
  bump/re-roll) so the pick always feels meaningful.
- **Determinism:** re-roll draws from the run seed on a dedicated stream (e.g.
  `${seed}#reward${fightNumber}`), so a given run replays identically.
- **What changed:** on confirm, the screen shows the concrete delta (e.g. `Boxing 74 → 82`, or
  the re-roll result, or `Healed 45 · 46 → 91`).

## 7. Screens & controller

### `App` — thin run controller
Holds `run: RunState | null`; renders the screen for `run.phase` (null → landing Hub). Passes
data down, receives callbacks up. **`BottomNavBar` removed** from the flow. **`TopAppBar`**
gains a compact run-status readout: `Fight 3 · 2–0 · Challenger`, or `★ Champion · Reign 2`, or
`Run Ended`.

### Championship Hub (`ChampionshipHubScreen`) — controlled
Home base between every fight; content by state:
- **Landing (no run):** title + **"Start New Run"** → begins draft.
- **Pre-fight, climb (1–4):** fighter (name + 9-stat grid via `StatBar`), durability meter
  showing carried damage, red-accented **next-opponent** card (name, style, threat), CTA
  **"Enter the Octagon"**, "Fight N of 5 to the belt · 3 rounds".
- **Pre-fight, fight 5:** framed **"For the Vacant Belt"** (5 rounds), CTA "Fight for the Belt".
- **Pre-fight, champion (6+):** belt banner **"Champion · Reign N"**, CTA **"Defend the Belt"**,
  "Fight M · 5 rounds · N defenses made".
- **Run-over (loss):** minimal summary — final reign (defenses) + record + method — CTA
  **"Start New Run"**. (Celebration/best-reign → M7.)

### Reward (`RewardScreen`) — controlled
- **Step 1:** "You Win!" + method (e.g. `KO · Round 2`) → three reward-type cards (Recover
  disabled at full health) → "Choose Stat →".
- **Step 2:** target picker — for bump/re-roll, the 9 stats as tappable `StatBar` rows with
  current values; a **"Boxing → 82"** what-changed line; **"Confirm & Continue"** and
  **"← Back to rewards"**. Recover skips the picker (confirm directly).
- Emits `onReward(reward)` → controller calls `applyReward`.

### DraftScreen — wire the existing seam
Connect `onComplete(draftedFighter)` → `applyDraft`. The draft uses the **run seed**. Fold nits
(§9). Draft's own `DraftState` stays internal for M6.

### FightScreen — becomes controlled
Accepts `fighter` (name + statLine), `fightNumber`, `carriedDamage`; reports `onWin(fightState)`
/ `onLoss(fightState)` (or one `onSettled`) upward. Drops `DEMO_FIGHTER`, `DEMO_NAME`, and its
self-managed seed/fight counter. **Keeps** the `advanceFight` post-settlement guard. The
"New Fight" button is removed — the controller decides what comes next.

## 8. Determinism

One **run seed** anchors everything (fights, opponents, and reward re-rolls) so a run is
reproducible and M7 can persist+resume it exactly. Derivable streams:
- Opponents: `${seed}#opp${fightNumber}` (already in the engine).
- Round resolution: **fold `fightNumber` into the stream** — `${seed}#f${fightNumber}#r${round}`
  (see §9) so chained fights on one seed don't reuse round-noise.
- Reward re-roll: `${seed}#reward${fightNumber}`.

## 9. Carryover nits to fold here

1. **DraftScreen `onComplete` in setState updater** → move the `onComplete?.()` side-effect out
   of the `setState` updater (StrictMode double-fire risk) now that the seam is wired.
2. **DraftScreen `getDraftedFighter` hoist** → call once, not inside the `STAT_IDS.map` loop.
3. **DraftScreen "New Draft" seed** → in run context the draft is seeded by the run seed
   (product call resolved: run-driven).
4. **Round-roll RNG stream** → fold `fightNumber` into `resolveRound`'s stream (`fight.ts`).
   **This re-bakes the fight determinism vectors**, so the affected M4 (`fight.test.ts`) and M5
   (`FightScreen.test.tsx`) baked values are updated in the same PR. Correctness (independent
   round-noise per fight) outweighs preserving arbitrary baked numbers.

## 10. Testing strategy (strict TDD)

- **`run.ts`** unit tests: each transition; full-run happy path (draft → win×4 → belt at 5 →
  defense → loss ends run); reign counting (belt = 0 defenses, +1 per defense); permadeath on
  first loss; damage carry across fights; serializability (round-trip `JSON.parse(JSON
  .stringify(run))` equals the state).
- **Reward** unit tests: bump clamps at 99; recover floors at 0 and is disabled at 0 damage;
  re-roll is deterministic off the seed and can go up or down; bump-Chin raises durability.
- **Screen** RTL tests: Hub renders each state and fires the right CTA callback; Reward two-step
  pick emits the correct `reward`; controlled FightScreen consumes props and reports settle.
- **App/controller** integration test: drive a seeded run through draft → fight → reward → next
  fight and assert the phase/screen transitions.
- **Determinism guard:** re-bake and assert the new fight vectors after the §9.4 stream change.

## 11. Success criteria

- Full run playable UI-only, no dev nav; first belt reachable in one sitting.
- `RunState` is serializable and round-trips cleanly (M7-ready).
- Damage carries; rewards visibly change the fighter with what-changed feedback.
- All prior tests green (re-baked where §9.4 requires); engine's public API unchanged except the
  round-stream seed string.

## 12. Open items (deferred, non-blocking)

- Exact reward magnitudes / difficulty curve — tunable constants (product spec defers tuning).
- Opponent "threat" indicator on the Hub is presentational; derive from `fightNumber` only.
- Mid-draft resume persistence — M7.
