# M10 — v2.1 Combat Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (fresh implementer + reviewer per task) with strict TDD. Steps use `- [ ]` checkboxes.

**Goal:** Make each round's decision fit its fighting context — striking keeps Pressure/Counter/Pick-apart; wrestling becomes *shoot → (if it lands) choose Ground & Pound or Submission* — and remove the striking vocabulary that made no sense for grappling. Re-tune balance for the new decision space.

**Architecture:** Decision-layer redesign, not an engine rewrite. `resolveRound` already computes a per-side attack score by chosen phase and applies damage to the loser; we (1) replace the flat `RoundIntent` with a discriminated union, (2) branch the winner's effect on `intent.kind` (strike → damage as today; wrestle → open a **ground window**), (3) add `groundStep` (mirrors `finishStep`) for the Ground & Pound / Submission choice, reusing the existing `window` field with a transient `method:'ground'` and the `FinishSequencePanel` UX pattern. Then re-tune.

**Tech stack:** React 18 + TS strict + Vite + Vitest/RTL, client-only, seeded RNG (`createRng`), no `Math.random` in `src`.

## Global Constraints (verbatim, apply to EVERY task)

- TypeScript strict, **no `any`**. No new runtime dependencies. `package.json`/lockfile unchanged.
- **No `Math.random` in `src/`** — all randomness via `createRng(seed)`; keep RNG draws uniform/upfront in AI so `opponent.test.ts` uniformity invariants hold.
- Every commit ends with exactly one trailer, verbatim (confirm the word "App"): `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`.
- Push after every commit; verify `git rev-parse HEAD == git rev-parse @{u}` before continuing.
- Determinism is sacred: same seed ⇒ same fight, and a persisted fight resumes byte-identically. Reproducibility + divergent-seed integration tests must stay green.
- Scope: `src/domain/combat/*`, `src/components/{IntentPanelV2,FinishSequencePanel,GroundPanel}.tsx`, `src/screens/FightView.tsx`, `src/fightDisplay.ts`, `src/App.tsx`, `src/persistence/runStorageV2.ts`, and their tests. No roster/archetype/stat-vocabulary changes (M9 owns roster). No avatars (M11).
- One PR into `main`. CI `build-and-test` green on head. **Do NOT merge** — the orchestrator reviews (GPT-5.5 xhigh + Copilot), merges, deploys.
- Gate at every task end: `npx vitest run` green, `npx tsc --noEmit` clean, `npx vite build` ok.

## File Map

- `src/domain/combat/intents.ts` — REWRITE: union `RoundIntent`, `StrikeTactic`, `GroundPlan`, labels, guards, `intentPhase`, `PHASE_OFFENSE/PHASE_DEFENSE` (drop `grapple`).
- `src/domain/combat/stats.ts` — MODIFY: `PHASE_OFFENSE/PHASE_DEFENSE` now keyed by `'strike'|'wrestle'` only.
- `src/domain/combat/fightState.ts` — MODIFY: `FightPhase` += `'ground-window'`; `FinishWindow.method` += `'ground'`; rewrite `opponentIntent` to the union.
- `src/domain/combat/resolve.ts` — MODIFY: new exchange math + branch winner effect on `intent.kind`; open ground-window on a winning wrestle.
- `src/domain/combat/finish.ts` — MODIFY: add `groundStep`; keep `finishStep`/`detectWindow`; update grapple read-path to wrestle+submission; clamp `ROCKED_HEAD_DMG ≥ 1`.
- `src/domain/combat/stamina.ts` — MODIFY: `staminaCost(intent: RoundIntent)` signature.
- `src/domain/combat/balance.test.ts` — MODIFY: good/careless policies in new vocabulary; strengthen bands (Task 5).
- `src/components/IntentPanelV2.tsx` — REWRITE: Strike vs Wrestle; Strike reveals Head/Body + 3 tactics; Wrestle = single "Shoot" commit.
- `src/components/GroundPanel.tsx` — CREATE: Ground & Pound / Submission (offense) using the `FinishSequencePanel` styling.
- `src/screens/FightView.tsx` — MODIFY: render `GroundPanel` on `phase==='ground-window'`; pass `onGroundStep`.
- `src/App.tsx` — MODIFY: wire `handleGroundStep` (calls `groundStep`, persists).
- `src/fightDisplay.ts` — MODIFY: `roundLabel` handles `'ground-window'`; no striking words on grappling.
- `src/persistence/runStorageV2.ts` — MODIFY: `'ground-window'` phase↔payload invariant in `isValidFightState`.

---

### Task 1: New decision vocabulary + strike/wrestle exchange (no ground window yet)

Foundational type flip. Ends with the app compiling and all tests green: decisions are `strike{target,tactic}` | `wrestle`; wrestle resolves as a takedown *exchange* that damages the loser (interim — the ground window arrives in Task 2). Grappling shows no striking words.

**Files:** intents.ts, stats.ts, fightState.ts, resolve.ts, finish.ts, stamina.ts, IntentPanelV2.tsx, FightView.tsx, App.tsx, fightDisplay.ts + every affected `.test.ts(x)`; balance.test.ts policy vocabulary.

**Interfaces (Produces):**
```ts
// intents.ts
export type StrikeTactic = 'pressure' | 'counter' | 'pickApart';
export type GroundPlan   = 'ground-and-pound' | 'submission';
export type Target = 'head' | 'body';
export type RoundIntent =
  | { kind: 'strike'; target: Target; tactic: StrikeTactic }
  | { kind: 'wrestle' };
export type Phase = 'strike' | 'wrestle';
export const STRIKE_TACTICS: readonly StrikeTactic[] = ['pressure','counter','pickApart'] as const;
export const GROUND_PLANS:  readonly GroundPlan[]   = ['ground-and-pound','submission'] as const;
export const TARGETS:       readonly Target[]       = ['head','body'] as const;
export const KIND_LABELS:          Record<'strike'|'wrestle',string> = { strike:'Strike', wrestle:'Wrestle' };
export const STRIKE_TACTIC_LABELS: Record<StrikeTactic,string> = { pressure:'Pressure', counter:'Counter', pickApart:'Pick Apart' };
export const GROUND_PLAN_LABELS:   Record<GroundPlan,string>   = { 'ground-and-pound':'Ground & Pound', submission:'Submission' };
export const TARGET_LABELS:        Record<Target,string>       = { head:'Head', body:'Body' };
export function isStrike(i: RoundIntent): i is Extract<RoundIntent,{kind:'strike'}> { return i.kind === 'strike'; }
export function intentPhase(i: RoundIntent): Phase { return i.kind === 'strike' ? 'strike' : 'wrestle'; }
// stats.ts
export const PHASE_OFFENSE = { strike: 'striking', wrestle: 'takedowns' } as const;
export const PHASE_DEFENSE = { strike: 'strikingDef', wrestle: 'takedownDef' } as const;
```

**Exchange math (resolve.ts) — generalizes today's two-sided model:**
```
atkMult(i)  = i.kind==='strike' ? STRIKE_TACTIC_ATK[i.tactic] : WRESTLE_ATK        // wrestle has no tactic
defMult(defender, incomingPhase):
   defender.kind==='strike' && incomingPhase==='strike' → STRIKE_TACTIC_DEF[defender.tactic]
   defender.kind==='wrestle'&& incomingPhase==='strike' → WRESTLE_VS_STRIKE_DEF     // shooting leaves you open (<1)
   incomingPhase==='wrestle'                            → 1.0                        // takedownDef stat carries it
playerAtk = pOff[pPhase]*pEffort*atkMult(pIntent) - oDef[pPhase]*oEffort*defMult(oIntent,pPhase) + counterBonus
oppAtk    = oOff[oPhase]*oEffort*atkMult(oIntent) - pDef[oPhase]*pEffort*defMult(pIntent,oPhase) + counterBonus
dominance = playerAtk - oppAtk + (pIQ-oIQ)*IQ_FACTOR + seededSwing
counterBonus: unchanged — a striking Counter that meets a striking Pressure gets +COUNTER_BONUS.
```
Constants (Task-5 tunable): `STRIKE_TACTIC_ATK={pressure:1.3,counter:0.8,pickApart:1.0}`, `STRIKE_TACTIC_DEF={pressure:0.8,counter:1.2,pickApart:1.0}`, `WRESTLE_ATK=1.0`, `WRESTLE_VS_STRIKE_DEF=0.7`.

**Winner effect (Task 1 interim):** loser takes `dmg=round(|dominance|*DMG_FACTOR)`; damage type = winner's `target` if the winner struck, else `head` (wrestle interim). Striking finish detection unchanged. (Task 2 replaces the "winner wrestled" path with a ground window.)

**staminaCost:** `staminaCost(i: RoundIntent)` → strike cost varies by tactic (pressure highest), wrestle a fixed shoot cost. Preserve current magnitudes so stamina tests stay meaningful.

- [ ] **Step 1 — Failing test: intents union + guards.** In `intents.test.ts` assert `intentPhase({kind:'strike',target:'head',tactic:'pressure'})==='strike'`, `intentPhase({kind:'wrestle'})==='wrestle'`, `isStrike` narrows, and the label maps exist. Run → FAIL (symbols absent).
- [ ] **Step 2 — Implement intents.ts + stats.ts** per interfaces. Run intents.test → PASS.
- [ ] **Step 3 — Migrate resolve.ts** to the new exchange math + interim winner effect; update `resolve.test.ts` to new intents. **Regression assertion:** a pure strike-vs-strike round with the same tactics/stats yields the SAME `dominance` sign and damage as before (numbers may shift only if you change constants — keep them equal in Task 1). Run → PASS.
- [ ] **Step 4 — Migrate fightState.ts `opponentIntent`** to return the union: choose `strike` vs `wrestle` by the opponent's better edge (`(striking - player.strikingDef)` vs `(takedowns - player.takedownDef)`); strike tactic chosen by fightNumber aggression as today; keep RNG draws uniform/upfront. Update `fightState.test.ts`. Run → PASS.
- [ ] **Step 5 — Migrate finish.ts refs** (`playerIntent.where==='grapple'` read-path → `intent.kind==='wrestle'` + low `submissionDef`), `stamina.ts` signature, and all remaining combat tests. Run full combat suite → PASS.
- [ ] **Step 6 — Migrate UI to compile:** IntentPanelV2 → Strike/Wrestle selector (Strike shows Head/Body + tactics; Wrestle shows a single "Shoot for the takedown" commit that calls `onCommit({kind:'wrestle'})`); FightView/App intent types; `fightDisplay.roundLabel`. Update component tests to the new panel. Run `vitest`, `tsc`, `vite build` → all PASS/clean.
- [ ] **Step 7 — balance.test.ts vocabulary:** rewrite good/careless policies in new vocabulary (good: pickApart when even, pressure vs hurt/gassed, counter vs pressure, wrestle when opp `takedownDef` is the weak point; careless: always pressure). Keep the CURRENT band floors (0.25/0.80/0.15/0.40) for now. Run → PASS (if a band is marginally red from the model shift, adjust only interim constants to restore green; do NOT weaken floors — real strengthening is Task 5).
- [ ] **Step 8 — Commit** `feat(combat): style-aware round intents (strike tactics vs wrestle)`.

---

### Task 2: Ground window + `groundStep` (player offense)

A winning player wrestle opens a ground window; the player chooses Ground & Pound or Submission.

**Files:** fightState.ts, resolve.ts, finish.ts, components/GroundPanel.tsx (create), screens/FightView.tsx, App.tsx, fightDisplay.ts + tests.

**Interfaces (Produces):**
```ts
// fightState.ts
export type FightPhase = 'in-round' | 'finish-window' | 'ground-window' | 'finished';
export interface FinishWindow { side:'player'|'opponent'; method:'KO'|'submission'|'ground'; stepsLeft:number; }
// finish.ts
export function groundStep(state: FightState, plan: GroundPlan): FightState; // requires phase==='ground-window'
```

**resolve.ts:** when `dominance>0 && pIntent.kind==='wrestle'` → return `{...state, phase:'ground-window', window:{side:'player',method:'ground',stepsLeft:INITIAL_STEPS}, ...damage:none, log:[...]}` (round NOT advanced). (Opponent-winning wrestle stays interim/T3.)

**groundStep(state, plan):** rng seed `${seed}#f${fightNumber}#r${round}#ground${INITIAL_STEPS-window.stepsLeft}`.
- `plan==='ground-and-pound'`: `gpDmg = max(GP_MIN, round((0.5*striking + 0.5*takedowns) - 0.5*opp.strikingDef) * GP_FACTOR)` applied to opponent head; if `preHead<ROCKED && post≥ROCKED` → `outcome{winner:side,method:'KO',round}` (TKO), phase `finished`; else close window, advance round (or finish if last round → scoreFight). Constants `GP_MIN`, `GP_FACTOR` tunable T5.
- `plan==='submission'`: `p = clamp(SUB_BASE + (submissions - opp.submissionDef)*SUB_SCALE, 0.05, 0.95)`; `roll<p` → `outcome{winner:side,method:'submission',round}`; else stamina cost + advance round (mirror `finishStep` failure). Constants tunable T5.

- [ ] **Step 1 — Failing test:** in `finish.test.ts`, drive a real fight so the player wins a `wrestle`; assert `phase==='ground-window'`, `window.method==='ground'`, round not advanced. FAIL first.
- [ ] **Step 2 — Implement** the resolve.ts ground-window open. PASS.
- [ ] **Step 3 — Failing tests for `groundStep`:** GnP on a low-chin opponent → `outcome.method==='KO'`; Submission vs low `submissionDef` with a committing seed → `outcome.method==='submission'`; a high-`submissionDef` opponent → no finish, round advances; `groundStep` throws unless `phase==='ground-window'`. FAIL.
- [ ] **Step 4 — Implement `groundStep`.** PASS.
- [ ] **Step 5 — UI: GroundPanel** (offense) mirroring `FinishSequencePanel` (2-button grid, `data-testid="ground-panel"`, buttons `ground-gnp` / `ground-sub`, headline "TOP CONTROL"); FightView renders it on `phase==='ground-window'` and calls `onGroundStep`; App `handleGroundStep` calls `groundStep` + persists; `roundLabel` handles the phase. Component + FightView tests. PASS, `tsc`/`build` clean.
- [ ] **Step 6 — Commit** `feat(combat): wrestle→ground window with ground-and-pound / submission`.

---

### Task 3: Opponent ground threat + AI ground choice

The opponent can take the player down and threaten GnP/submission; dangerous outcomes route through the existing finish-window so the player keeps defensive agency.

**Files:** resolve.ts, finish.ts, fightState.ts (opponentIntent), tests.

- When `dominance<0 && oIntent.kind==='wrestle'`: opponent's takedown lands → auto-resolve the opponent's ground action (AI picks `submission` if `player.submissionDef < LOW_SUB_DEF` else `ground-and-pound`). Apply the same GnP/submission math against the player. If it reaches finish level (GnP rocks the player, or submission would land) → open a normal `finish-window{side:'opponent', method:'KO'|'submission'}` (player defends via `FinishSequencePanel`, existing). Otherwise apply partial damage / advance round.
- `opponentIntent`: strikers/brawlers favor strike, wrestlers/grapplers favor wrestle, allrounders by matchup; already returns the union from Task 1 — extend so a wrestling opponent's follow-up is implied by AI in resolve (no UI).

- [ ] **Step 1 — Failing test:** seed a fight where a wrestler opponent beats the player in the wrestle phase; assert the player takes ground damage and, at finish level, a `finish-window{side:'opponent'}` opens. FAIL.
- [ ] **Step 2 — Implement** the opponent ground branch + AI ground choice. PASS.
- [ ] **Step 3 — Opponent invariants:** run `opponent.test.ts` (monotonic target curve, ≤90, span ≤40, ±2 avg, RNG uniformity) → PASS unchanged.
- [ ] **Step 4 — Commit** `feat(combat): opponent takedown + ground threat routes through finish window`.

---

### Task 4: Persistence — `'ground-window'` invariant + resume

**Files:** persistence/runStorageV2.ts + test.

Add to `isValidFightState` (mirror the finish-window contract exactly so engine output is never false-rejected): `phase==='ground-window' ⇒ window!==null && window.method==='ground' && outcome===null`; and `in-round ⇒ window===null`; keep `finish-window ⇒ window.method∈{KO,submission}`. On failure keep `clearKey()+defaults()` → fresh Hub.

- [ ] **Step 1 — Failing tests:** (a) a REAL engine-produced ground-window run (`startRun→applyDraft→startNextFight→resolveRound` until `phase==='ground-window'`) deep-equals round-trip through `save`/`load`; (b) a corrupt `ground-window` blob with `window:null` (or `method:'KO'`) → `load()` returns null + key cleared. FAIL first (find the seed via a throwaway probe, then hardcode it).
- [ ] **Step 2 — Implement** the invariant. PASS. Existing round-trips (mid-fight, finish-window, finished) stay green.
- [ ] **Step 3 — Commit** `fix(persistence): enforce ground-window phase↔payload invariant on load`.

---

### Task 5: Final balance tuning — strengthen bands + retune + rock-threshold clamp

**Files:** balance.test.ts, resolve.ts, finish.ts, opponent.ts.

Strengthen the bands M9 deferred (never weaken below the current live floor; **Achievable-floor rule:** if a target is unreachable without pushing another band red, back THAT ONE assertion to best-stable-achieved but still ≥ its live floor, and comment the measured value):
- BAND1 finish (good, avg 1–10) ≥ **0.30** (live 0.25)
- BAND2 careless@1 ≤ **0.72** (live 0.80) AND good@1 − careless@1 ≥ **0.20** (live 0.15)
- BAND3 good@9 ≥ **0.45** AND good@10 ≥ **0.45** (live 0.40; never 0)
- BAND4 no-runaway unchanged (late < early, late < 0.90)

Also: **clamp `ROCKED_HEAD_DMG(chin) = Math.max(1, Math.round(chin*k))`** (closes Copilot's finish.ts nit — a chin that rounds to 0 makes the damage-path window impossible). Add a unit test `ROCKED_HEAD_DMG(1) >= 1`.

Tuning knobs: `DMG_FACTOR`, `GP_FACTOR`/`GP_MIN`, `SUB_BASE`/`SUB_SCALE`, `WRESTLE_VS_STRIKE_DEF`, `ROCKED_HEAD_DMG` k, opponent `targetRating` intercept. Re-measure 300 seeds, deterministic/re-run-stable. Keep `finish.test.ts` green (don't raise `COMMIT_P` past what it asserts — drive finishes via other knobs, as M9 found).

- [ ] **Step 1 — Strengthen assertions** (RED): update balance.test.ts to the targets above; run → RED with measured values printed.
- [ ] **Step 2 — Add `ROCKED_HEAD_DMG≥1` test** (RED) then clamp (GREEN).
- [ ] **Step 3 — Retune constants** to GREEN across all 4 bands; re-run twice to confirm determinism. Apply Achievable-floor only if needed (document measured margin in a comment).
- [ ] **Step 4 — Commit** `balance(combat): retune for the strike/wrestle/ground decision space`.

---

### Task 6: Integration + resume e2e + final gate

**Files:** integration.test.ts, e2e.resume.test.tsx.

- [ ] **Step 1 — Full-run integration:** a deterministic run that exercises a strike KO, a wrestle→Ground & Pound TKO, and a wrestle→Submission win across a title run; reproducibility (same seed identical) + divergent-seed tests green.
- [ ] **Step 2 — Resume e2e:** persist a fight parked in `phase==='ground-window'`, reload, assert the GroundPanel renders and `groundStep` continues deterministically to the same outcome.
- [ ] **Step 3 — Final gate:** `vitest run` (count > 156), `tsc --noEmit` clean, `vite build` ok, `grep -rn 'Math.random(' src` = 0 invocations, package.json/lock unchanged. Confirm no grappling decision shows striking vocabulary anywhere in the UI.
- [ ] **Step 4 — Commit** `test(combat): full-run integration + ground-window resume`.

---

## Self-Review

- **Spec coverage:** design §3 decision model → T1; §wrestle→ground → T2; §opponent AI → T1/T3; §persistence → T4; §balance → T5; §UI → T1/T2; §DoD → T6. Copilot finish.ts nit → T5. Covered.
- **Type consistency:** `RoundIntent` union, `intentPhase`, `PHASE_OFFENSE/DEFENSE` (strike/wrestle), `FinishWindow.method:'KO'|'submission'|'ground'`, `groundStep(state,GroundPlan)`, `GroundPlan='ground-and-pound'|'submission'` used consistently across tasks.
- **No placeholders.** Formulas + constants + exact test assertions given; repetitive UI/test bodies reference the concrete existing patterns (FinishSequencePanel, resolve.test) to copy.
- **Green discipline:** T1 keeps interim behavior + current floors so every task ends green; real strengthening isolated to T5.
