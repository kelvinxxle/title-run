# M14 — Fight Feel + The Corner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task with a fresh implementer + fresh reviewer per task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the fight feel alive and strategic — surface the engine's hidden drama (head/body/gas meters, per-round narration, momentum, juice) and add a between-round **Corner** where the player picks a game plan — without disturbing the deep, balance-tuned combat math.

**Architecture:** Additive. A new pure display/report layer surfaces existing engine data. A new `'corner'` `FightPhase` is inserted between normal rounds; `resolveRound` routes there and applies a `GamePlan` modifier to the next exchange. All new logic is pure/deterministic; all juice is CSS/state. The M12 balance-band sim is updated to drive the corner and MUST stay green.

**Tech Stack:** React 18, TypeScript (strict), Vite, TailwindCSS, Vitest + React Testing Library. Client-only, seeded RNG.

## Global Constraints (verbatim, apply to EVERY task)

- **No `Math.random`** anywhere in `src/` — seeded `createRng` or pure functions only. `grep -rn 'Math.random(' src` MUST return 0.
- **No new dependencies.** `git diff --stat origin/main -- package.json package-lock.json` MUST be empty.
- **Determinism:** same inputs → byte-identical output. All animation is CSS/state-driven, never RNG.
- **Strict TDD:** every task writes a failing test FIRST, confirms RED, then implements to GREEN.
- **Every commit** ends with EXACTLY: `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`
- **Full gate before the PR is "done":** `npx vitest run` (×2, identical) · `npx tsc --noEmit` clean · `npm run build` clean · 0 `Math.random` · lockfile unchanged.
- **Do NOT merge.** Open ONE PR off `main` and stop.
- TypeScript strict: no `any` leaks, exhaustive unions, no non-null assertions on untyped data.

## Baseline facts (verified against `main` @ 829247b)

- `FightPhase = 'in-round' | 'finish-window' | 'ground-window' | 'finished'`. `FightState` has `player`, `opponent` (`Fighter2` = `{statLine, headDamage, bodyDamage, stamina, roundScore}`), `round`, `rounds`, `phase`, `window`, `outcome`, `log: RoundLogEntry[]`, `seed`, `fightNumber`.
- `RoundLogEntry = { round, playerIntent, opponentIntent, winner:'player'|'opponent'|'draw', dominance:number }`.
- `resolveRound(state, playerIntent)` requires `phase==='in-round'`; normal-advance path currently sets `phase:'in-round'` for the next round. Finish/ground windows are separate.
- `healthPct(f) = clamp01(1 − headDamage/chin)` in `src/fightDisplay.ts` (head-only; body ignored).
- `ROCKED_HEAD_DMG(chin) = max(1, round(chin*0.56))` (exported from `finish.ts`).
- Stamina: `STAMINA_MAX=100`, `GAS_THRESHOLD=25`, `isGassed(s)=s<25`, `effortMultiplier`, `recovery(statLine)`, `staminaCost(intent)`.
- App.tsx owns `run.fight`; dispatches `resolveRound`(in-round) / `finishStep`(finish-window) / `groundStep`(ground-window) / `settleFight`(finished→continue), each guarded by `run.fight.phase`.
- Persistence `src/persistence/runStorageV2.ts`: `SCHEMA_VERSION=2`, `FIGHT_PHASES` list + `isValidFightState` validates `phase ∈ FIGHT_PHASES` and phase↔window/outcome invariants. `load()` discards on `version !== SCHEMA_VERSION`.
- Balance `src/domain/combat/balance.test.ts`: `simulate(fightNumber, policy)` over 300 seeds, GSP reference, `playFight` loop over `resolveRound`/`groundStep`/`finishStep`, BAND 1–6 assertions.

## File Map

- `src/domain/combat/intents.ts` — ADD `GamePlan` union, `GAME_PLANS`, `GAME_PLAN_LABELS`, `GAME_PLAN_BLURBS`.
- `src/domain/combat/fightState.ts` — ADD `'corner'` phase; `gamePlan`/`lastReport` fields on `FightState`; `chooseGamePlan`; export helpers.
- `src/domain/combat/report.ts` (NEW) — `RoundReport`, `RoundReportInput`, pure `buildRoundReport`.
- `src/domain/combat/resolve.ts` — route normal advance → `'corner'`; build+store `lastReport`; apply+clear `gamePlan` modifier.
- `src/domain/combat/gameplan.ts` (NEW) — `GamePlanEffect`, `GAME_PLAN_EFFECTS`, pure `applyGamePlan(...)` helpers (kept out of resolve.ts for focused testing/tuning).
- `src/domain/combat/index.ts` — barrel is `export *`; new exports propagate automatically (verify).
- `src/persistence/runStorageV2.ts` — `'corner'` in `FIGHT_PHASES`; validate `gamePlan`/`lastReport`; corner phase invariant; bump `SCHEMA_VERSION` → 3.
- `src/fightDisplay.ts` — ADD `bodyPct`, `headState`, `gasState`.
- `src/components/FighterHealthCard.tsx` — three meters (head/body/gas), hurt/rocked, damage flash `−N`.
- `src/components/MomentumBar.tsx` (NEW) — round-win pips from `log`.
- `src/components/RoundRecap.tsx` (NEW) — renders a `RoundReport`.
- `src/components/CornerScreen.tsx` (NEW) — recap + momentum + meters + game-plan cards.
- `src/screens/FightView.tsx` — render `corner` phase, pass meters/report/momentum; last-round recap in `finished`.
- `src/App.tsx` — dispatch `chooseGamePlan` on `corner`.
- `src/domain/combat/balance.test.ts` — update `playFight` to drive the corner; keep BANDs green.
- Tests colocated with each source file.

---

### Task 0: Commit design + plan docs

**Files:** Create `docs/superpowers/specs/2026-07-04-m14-fight-feel-corner-design.md` (the design doc, provided) and `docs/superpowers/plans/2026-07-04-m14-fight-feel-corner.md` (this plan).

- [ ] **Step 1:** Write both docs to those paths (content provided in the handoff).
- [ ] **Step 2:** Commit (docs-only, no tests): `git add docs/superpowers && git commit` — subject `docs(m14): fight-feel + corner design + plan` + trailer.

---

### Task 1: Display helpers — `bodyPct`, `headState`, `gasState` (pure)

**Files:** Modify `src/fightDisplay.ts`; Test `src/fightDisplay.test.ts`.

**Interfaces — Produces:**
- `bodyPct(fighter: Fighter2): number` — `clamp01(1 − bodyDamage / BODY_DISPLAY_CAP)`, `BODY_DISPLAY_CAP = 50` (display-only constant; NOT a balance knob — comment it).
- `headState(fighter: Fighter2): 'fresh' | 'hurt' | 'rocked'` — using `ROCKED_HEAD_DMG(chin)`: `rocked` if `headDamage ≥ ROCKED_HEAD_DMG(chin)`; `hurt` if `headDamage ≥ 0.6*ROCKED_HEAD_DMG(chin)`; else `fresh`.
- `gasState(stamina: number): 'ok' | 'low'` — `low` iff `isGassed(stamina)`.

- [ ] **Step 1 (RED):** Tests: `bodyPct` 0 damage → 1; `bodyDamage=25` → 0.5; `≥50` → 0 (clamped). `headState`: fresh at 0; a fighter with `chin=50` (ROCKED=28) → `hurt` at `headDamage=17` (0.6*28=16.8→≥ so 17 hurt), `rocked` at 28, `fresh` at 16. `gasState`: `ok` at 25, `low` at 24. Run → FAIL (not exported).
- [ ] **Step 2:** Implement the three helpers + `BODY_DISPLAY_CAP`. Import `ROCKED_HEAD_DMG`, `isGassed`.
- [ ] **Step 3 (GREEN):** `npx vitest run src/fightDisplay.test.ts`.
- [ ] **Step 4:** Commit `feat(fight-ui): head/body/gas display helpers` + trailer.

---

### Task 2: `buildRoundReport` — deterministic play-by-play (pure)

**Files:** Create `src/domain/combat/report.ts`; Test `src/domain/combat/report.test.ts`.

**Interfaces — Produces:**
```ts
export interface RoundReportInput {
  round: number;
  winner: 'player' | 'opponent' | 'draw';
  dominance: number;
  playerIntent: RoundIntent;
  opponentIntent: RoundIntent;
  playerHeadDelta: number; playerBodyDelta: number;   // damage the PLAYER took this round
  opponentHeadDelta: number; opponentBodyDelta: number; // damage the OPPONENT took this round
  playerBecameRocked: boolean; opponentBecameRocked: boolean;
  playerGassed: boolean; opponentGassed: boolean;
}
export interface RoundReport {
  round: number;
  headline: string;   // short, dramatic, second-person ("You" = player)
  detail: string;     // one clause of texture (body/gas/counter read)
  winner: 'player' | 'opponent' | 'draw';
  playerHeadDelta: number; playerBodyDelta: number;
  opponentHeadDelta: number; opponentBodyDelta: number;
}
export function buildRoundReport(input: RoundReportInput): RoundReport;
```

**Narration rules (deterministic, priority-ordered — pick the first that matches for the headline):**
1. `opponentBecameRocked` → "You've got him HURT!" ; `playerBecameRocked` → "You're ROCKED — hang on!"
2. counter-beats-pressure read (winner side used `strike/counter` vs other's `strike/pressure`) → "Perfect counter — you read him cold." / mirror for opponent.
3. winner==='player' & dominance high (`≥15`) → "You lit him up." ; moderate (`>0`) → "You took the round." 
4. winner==='opponent' symmetric ("He walked you down." / "He out-worked you.").
5. draw → "Even round — nobody blinked."

**Detail rules (append the most salient, deterministic):** biggest of {body investment (`opponentBodyDelta≥8` → "Body work is adding up — his gas will pay for it."), gas (`opponentGassed` → "He's sucking wind."/`playerGassed` mirror), else the tactic matchup ("You picked him apart at range." etc.). Exactly one detail clause.

- [ ] **Step 1 (RED):** ~8 tests, one per rule branch, on hand-built inputs asserting exact `headline`/`detail` strings + deltas passthrough + determinism (same input twice → deep-equal). Run → FAIL (no module).
- [ ] **Step 2:** Implement `buildRoundReport` as a pure priority ladder. No RNG, no Date.
- [ ] **Step 3 (GREEN):** `npx vitest run src/domain/combat/report.test.ts`.
- [ ] **Step 4:** Commit `feat(combat): deterministic round-report builder` + trailer.

---

### Task 3: Game-plan effects (pure)

**Files:** Create `src/domain/combat/gameplan.ts`; add types to `src/domain/combat/intents.ts`; Test `src/domain/combat/gameplan.test.ts`.

**Interfaces — Produces:**
```ts
// intents.ts
export type GamePlan = 'push-pace' | 'work-body' | 'stay-disciplined' | 'catch-breath';
export const GAME_PLANS: readonly GamePlan[] = ['push-pace','work-body','stay-disciplined','catch-breath'] as const;
export const GAME_PLAN_LABELS: Record<GamePlan,string> = { 'push-pace':'Push the Pace','work-body':'Work the Body','stay-disciplined':'Stay Disciplined','catch-breath':'Catch Your Breath' };
export const GAME_PLAN_BLURBS: Record<GamePlan,string> = { 'push-pace':'Empty the tank for damage — but you\u2019ll tire.','work-body':'Break his body down and drain his gas.','stay-disciplined':'Tighten up and counter — protect the lead.','catch-breath':'Recover and reset — give ground this round.' };

// gameplan.ts
export interface GamePlanEffect { atkMult:number; defMult:number; staminaDelta:number; forceBodyTarget:boolean; }
export const GAME_PLAN_EFFECTS: Record<GamePlan, GamePlanEffect>;
/** Neutral (no plan) = identity {1,1,0,false} so the FIRST round + a null plan reproduce current balance. */
export function gamePlanEffect(plan: GamePlan | null): GamePlanEffect;
```
Initial effect values (T5 will retune against the bands — start here):
- `push-pace`: `{ atkMult:1.15, defMult:1.0, staminaDelta:-6, forceBodyTarget:false }`
- `work-body`: `{ atkMult:1.0, defMult:1.0, staminaDelta:0, forceBodyTarget:true }`
- `stay-disciplined`: `{ atkMult:1.0, defMult:1.15, staminaDelta:0, forceBodyTarget:false }`
- `catch-breath`: `{ atkMult:0.85, defMult:1.0, staminaDelta:+8, forceBodyTarget:false }`
- `null`: `{ atkMult:1.0, defMult:1.0, staminaDelta:0, forceBodyTarget:false }`

- [ ] **Step 1 (RED):** Tests: each plan maps to its effect; `gamePlanEffect(null)` is identity; `GAME_PLANS` length 4 + labels/blurbs cover every plan. FAIL (no module).
- [ ] **Step 2:** Implement the map + `gamePlanEffect`. Add the intents.ts exports.
- [ ] **Step 3 (GREEN).** [ ] **Step 4:** Commit `feat(combat): game-plan effect table` + trailer.

---

### Task 4: Engine — `'corner'` phase, `gamePlan`/`lastReport` state, `chooseGamePlan`, resolveRound routing + modifier

**Files:** Modify `src/domain/combat/fightState.ts`, `src/domain/combat/resolve.ts`; Test `src/domain/combat/resolve.test.ts` (+ `fightState.test.ts`).

**Interfaces — Consumes:** `buildRoundReport` (T2), `gamePlanEffect`/`GamePlanEffect` (T3). **Produces:**
- `FightPhase` gains `'corner'`.
- `FightState` gains `gamePlan: GamePlan | null` and `lastReport: RoundReport | null` (both start `null` in `startFight`).
- `chooseGamePlan(state: FightState, plan: GamePlan): FightState` — throws unless `phase==='corner'`; returns `{...state, gamePlan: plan, phase:'in-round'}`.
- `resolveRound` behavior changes:
  - Applies `gamePlanEffect(state.gamePlan)`: multiply the player's `playerAttackScore` by `atkMult`; multiply the player's defensive contribution (the term subtracted from `oppAttackScore`) by `defMult`; if `forceBodyTarget` and the player intent is a `strike`, treat target as `body`; apply `staminaDelta` to the player's post-round stamina (clamped). **Opponent side is unaffected by the player's plan.**
  - Builds `lastReport` via `buildRoundReport` from pre/post head+body deltas, `becameRocked` (crossed `ROCKED_HEAD_DMG`), `isGassed` post-stamina, `log`'s new entry winner/dominance/intents — on EVERY resolved exchange (including window-opening branches, so the corner/finish can show it).
  - **Routing:** on the NORMAL advance path (no window opened, round advances, fight not over) set `phase:'corner'` (was `'in-round'`) and **clear** `gamePlan:null`. When the fight ends on the normal path set `'finished'`. Window branches unchanged (except they also set `lastReport`). Clear `gamePlan:null` in every returned state after it's consumed.

**Critical:** the FIRST round is `in-round` with `gamePlan:null` (identity effect) → round 1 is byte-identical to pre-M14. Verify a full deterministic fight transcript is unchanged when the player always picks no-op path (see T6 balance).

- [ ] **Step 1 (RED):** Tests: (a) after a normal non-terminal `resolveRound`, `phase==='corner'`, `window===null`, `lastReport!==null`, round advanced; (b) `chooseGamePlan` from corner → `phase==='in-round'`, `gamePlan` set; throws off-corner; (c) `push-pace` raises player damage output vs `null` on a fixed seed (assert opponent headDamage strictly greater); (d) `catch-breath` leaves player with more post stamina than `null`; (e) `work-body` with a head strike routes damage to body (opponent bodyDamage greater, headDamage lower) on a fixed seed; (f) round 1 with `gamePlan:null` reproduces the exact pre-existing `resolveRound` result (guard determinism). Run → FAIL.
- [ ] **Step 2:** Implement. Keep the two-sided exchange math intact; inject the multipliers at the defined points; thread `lastReport`.
- [ ] **Step 3 (GREEN):** `npx vitest run src/domain/combat/resolve.test.ts src/domain/combat/fightState.test.ts`.
- [ ] **Step 4:** Commit `feat(combat): corner phase + game-plan modifier + round report` + trailer.

---

### Task 5: Balance — drive the corner in the sim, keep BANDs green (retune effects if needed)

**Files:** Modify `src/domain/combat/balance.test.ts`; possibly retune `GAME_PLAN_EFFECTS` in `gameplan.ts`.

**Interfaces — Consumes:** `chooseGamePlan`, `GamePlan`.

- [ ] **Step 1:** Update `playFight`: when `s.phase==='corner'`, call `chooseGamePlan(s, plan)` where `plan` is policy-derived — `'good'` picks a smart plan (e.g., `work-body` when opponent not gassed else `push-pace`; `stay-disciplined` if player is ahead on `roundScore`); `'careless'` always `push-pace`. Keep the existing intent/ground/finish logic.
- [ ] **Step 2:** Run `npx vitest run src/domain/combat/balance.test.ts`. If any BAND fails, **retune `GAME_PLAN_EFFECTS` multipliers** (not the M10/M12 combat constants) until all BANDs pass; record the measured good/careless winRate+finishRate table (fights 1–10) in a comment, mirroring the M12 table. The neutral identity guarantees the sim only shifts by the *chosen* plans.
- [ ] **Step 3 (GREEN):** All BAND 1–6 assertions pass; run twice for determinism.
- [ ] **Step 4:** Commit `test(balance): drive corner game-plans; bands green` (+ any `fix(balance): retune game-plan effects`) + trailer.

---

### Task 6: Persistence — allow `'corner'`, validate new fields, bump schema

**Files:** Modify `src/persistence/runStorageV2.ts`; Test `src/persistence/runStorageV2.test.ts`.

**Interfaces — Produces:** `SCHEMA_VERSION = 3`; `FIGHT_PHASES` includes `'corner'`; `isValidFightState` validates `gamePlan` (`null` or one of `GAME_PLANS`) and `lastReport` (`null` or an object) and adds the corner invariant: `phase==='corner'` ⇒ `window===null && outcome===null`. Keep the phase↔fighter and fight↔run invariants.

- [ ] **Step 1 (RED):** Tests: a valid `'corner'` FightState (with `gamePlan` a valid plan or null, `window`/`outcome` null) round-trips through `save`→`load`; a corner state with a non-null `window` is rejected (`load().run===null`); a bad `gamePlan` string is rejected; `version:2` payloads are discarded (bump). Run → FAIL.
- [ ] **Step 2:** Implement. Import `GAME_PLANS`.
- [ ] **Step 3 (GREEN):** `npx vitest run src/persistence/runStorageV2.test.ts`.
- [ ] **Step 4:** Commit `feat(persistence): persist corner phase + game plan (schema v3)` + trailer.

---

### Task 7: `FighterHealthCard` — three meters + hurt/rocked + damage flash

**Files:** Modify `src/components/FighterHealthCard.tsx`; Test `src/components/FighterHealthCard.test.tsx`.

**Interfaces — Consumes:** `headState`/`bodyPct`/`gasState` are computed by the CALLER (FightView) and passed in, to keep the card presentational. **Produces (new props):** add `bodyPct: number`, `staminaPct: number`, `headStateLabel: 'fresh'|'hurt'|'rocked'`, `damageFlash?: { head: number; body: number }`. Keep existing props/testids (`fighter-card-${side}`, the head `role="meter"` with `aria-label="${name} health"`, avatar/name/badge). Body + gas meters get `role="meter"` + distinct `aria-label`s (`${name} body`, `${name} stamina`) and testids `meter-body-${side}`, `meter-gas-${side}`.

Visuals: HEAD meter primary; when `headStateLabel==='hurt'` amber tint, `'rocked'` red pulse (CSS `animate-pulse`-style class + `data-head-state`). BODY + GAS thinner meters beneath. When `damageFlash.head>0` (or body) render a floating `−N` badge (`data-testid="dmg-${side}-head"`) and a flash class; animate via CSS keyed on `round` (no RNG).

- [ ] **Step 1 (RED):** Tests: renders three meters with correct `aria-valuenow` for head/body/gas; `data-head-state="rocked"` when label rocked; a `−N` badge appears with `damageFlash.head=12`; existing head-meter aria-label preserved. Update any existing FighterHealthCard tests to pass the new required props. Run → FAIL.
- [ ] **Step 2:** Implement. Reuse the segmented-bar aesthetic; add CSS transitions. Keep the no-avatar fallback branch byte-compatible where existing tests assert it.
- [ ] **Step 3 (GREEN).** [ ] **Step 4:** Commit `feat(fight-ui): head/body/gas health card with hurt/rocked + damage flash` + trailer.

---

### Task 8: `MomentumBar` + `RoundRecap` components

**Files:** Create `src/components/MomentumBar.tsx`, `src/components/RoundRecap.tsx`; Tests colocated.

**Interfaces — Consumes:** `RoundLogEntry[]` (MomentumBar), `RoundReport` (RoundRecap). **Produces:**
- `MomentumBar({ log, rounds }: { log: RoundLogEntry[]; rounds: number })` — a row of `rounds` pips; pip `i` colored by `log[i]?.winner` (`player`→primary, `opponent`→secondary, `draw`/absent→neutral). `data-testid="momentum-bar"`, each pip `data-winner=...`.
- `RoundRecap({ report }: { report: RoundReport })` — headline (display font), detail (body), and the four deltas as small `−N head / −N body` chips per fighter. `data-testid="round-recap"`.

- [ ] **Step 1 (RED):** MomentumBar: 3 rounds, log `[player, opponent]` → pips `[player, opponent, neutral]`. RoundRecap: given a report, renders headline + detail text + delta chips. FAIL (no modules).
- [ ] **Step 2:** Implement (pure presentational). [ ] **Step 3 (GREEN).** [ ] **Step 4:** Commit `feat(fight-ui): momentum bar + round recap` + trailer.

---

### Task 9: `CornerScreen` — recap + momentum + meters + game-plan cards

**Files:** Create `src/components/CornerScreen.tsx`; Test colocated.

**Interfaces — Consumes:** `RoundReport`, `RoundLogEntry[]`, `GAME_PLANS`/`GAME_PLAN_LABELS`/`GAME_PLAN_BLURBS`, `GamePlan`. **Produces:**
`CornerScreen({ report, log, rounds, nextRound, onChoosePlan }: { report: RoundReport | null; log: RoundLogEntry[]; rounds: number; nextRound: number; onChoosePlan: (p: GamePlan) => void })` — a "BETWEEN ROUNDS — CORNER" header, `<RoundRecap>` (if report), `<MomentumBar>`, a cornerman line, and 4 game-plan cards (`data-testid="plan-${plan}"`, label + blurb) each calling `onChoosePlan(plan)`. `data-testid="corner-screen"`.

- [ ] **Step 1 (RED):** renders recap + 4 plan buttons; clicking `plan-work-body` calls `onChoosePlan('work-body')`. FAIL.
- [ ] **Step 2:** Implement. [ ] **Step 3 (GREEN).** [ ] **Step 4:** Commit `feat(fight-ui): corner screen` + trailer.

---

### Task 10: Wire `FightView` + `App.tsx` (integration) + full gate

**Files:** Modify `src/screens/FightView.tsx`, `src/App.tsx`; Tests `src/screens/FightView.test.tsx`, `src/App.test.tsx`.

**Interfaces — Consumes:** everything above.
- FightView: compute `bodyPct/staminaPct/headState` for each fighter (via fightDisplay helpers) and pass to `FighterHealthCard`; pass `damageFlash` from `fightState.lastReport` deltas (player side = player deltas, opponent side = opponent deltas). Render `<MomentumBar>` under the cards. When `phase==='corner'` render `<CornerScreen ... onChoosePlan={onChoosePlan}>` (new prop). In `finished`, show the last `RoundRecap` above the OutcomeBanner if `lastReport`.
- App.tsx: add `handleChoosePlan(plan)` → guard `run.fight.phase==='corner'` → `{...r, fight: chooseGamePlan(r.fight, plan)}`; pass `onChoosePlan` to FightView.

- [ ] **Step 1 (RED):** App/FightView test: play a full deterministic fight through a corner — after a non-terminal round the corner screen shows; choosing a plan returns to the intent panel for the next round; meters show body + gas; a rocked opponent shows `data-head-state="rocked"`. Run → FAIL.
- [ ] **Step 2:** Implement wiring.
- [ ] **Step 3 (GREEN):** targeted tests, then **FULL GATE**: `npx vitest run` twice (identical count), `npx tsc --noEmit`, `npm run build`, `grep -rn 'Math.random(' src` = 0, lockfile diff empty.
- [ ] **Step 4:** Commit `feat(fight-ui): wire corner + live meters into the fight loop` + trailer.
- [ ] **Step 5:** Manual dev look (`npm run dev`): confirm the corner beat reads well, meters animate, rocked pulses, recap narrates. Note it in the PR body.

---

## PR

Open ONE PR off `main`: title `M14: fight feel + the corner`. Body = per-task RED→GREEN evidence, the balance table, gate output, trailer audit, changed-file list, and the dev-look note. **Do NOT merge.**

## Self-review checklist (run before opening the PR)

- Spec coverage: health redesign (T1,T7), round narration (T2,T8,T10), momentum (T8,T10), corner phase + game plans (T3,T4,T9,T10), persistence (T6), balance green (T5). ✅ all mapped.
- No `Math.random`; no new deps; determinism guard (T4 step f); every commit trailered; all BANDs green.
