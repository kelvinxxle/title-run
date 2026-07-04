# M9 — Roster Breadth + Final Tuning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task (fresh implementer + reviewer per task). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete Title Run v2 by broadening the draft roster from 8 to 40 real fighters across all five archetypes, and doing the final balance tuning that widens the (currently tight) M8 difficulty margins — with no change to the combat engine's public API or the UI.

**Architecture:** Two fully-decoupled, additive workstreams in the pure `src/domain/combat/` layer. (1) **Roster** is data: append fighters to `STARTER_ROSTER`; the draft/UI already render whatever the roster feeds them, so no UI changes are needed. (2) **Tuning** is numeric: the balance harness drives a **fixed player** (`getFighter('georges-st-pierre')`), so roster growth cannot move the balance bands — tuning is an independent change to the opponent-ladder / damage / finish constants. Everything stays deterministic and seeded (no `Math.random`).

**Tech Stack:** React 18.3.1 + TypeScript (strict) + Vite + Tailwind; Vitest + React Testing Library. Client-only, localStorage. No new runtime dependencies.

## Global Constraints

- **No new runtime dependencies** beyond `react` + `react-dom`.
- **No `Math.random` anywhere in `src/`** — all randomness flows through `createRng`/`pick` from `src/domain/rng.ts`. Same seed → same result.
- **TypeScript strict; no `any`.** All stats are integers on the 1–99 scale; use the existing `clampStat` for any computed stat.
- **Do NOT touch the combat engine's public API** (`src/domain/combat/index.ts` exports) or any UI file's behavior. This milestone changes roster **data**, roster/balance **tests**, and tuning **constants** only.
- **`getFighter('georges-st-pierre')` must keep resolving** — the balance and integration harnesses depend on GSP's id. Do not rename or remove GSP.
- Every commit ends with exactly one trailer, verbatim: `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>` (confirm the word "App" is present).
- Strict TDD: write the failing test first, run it to see it fail (RED), implement minimally, run to green, commit. One green commit per step-group.
- Branch off `main` @ `b556115` (post-M8b). Open one PR into `main`. **Do NOT merge.**

## Context: current state (read before starting)

Read these on `main` to ground yourself:
- `src/domain/combat/roster.ts` — `Fighter { id, name, archetype, signature: Partial<StatLine> }`; `STARTER_ROSTER` (8 fighters); `buildStatLine(fighter)` overlays `signature` onto the archetype base (`ARCHETYPES[archetype]`) and clamps; `rollFighter(rng, excludeIds)` picks from the roster minus `excludeIds`; `getFighter(id)` throws on unknown id.
- `src/domain/combat/archetypes.ts` — `ArchetypeId = 'striker'|'wrestler'|'grappler'|'allrounder'|'brawler'`; `ARCHETYPES` base stat lines; `ARCHETYPE_IDS`.
- `src/domain/combat/roster.test.ts` — current invariants (asserts `toHaveLength(8)` — this WILL change).
- `src/domain/combat/draft.ts` — `startDraft`/`keepStat` roll fighters via `rollFor(seed, rollCount, exclude)` → `rollFighter`. A full draft makes up to 9 rolls, each excluding already-rolled ids.
- `src/domain/combat/balance.test.ts` — the difficulty harness. `const PLAYER = buildStatLine(getFighter('georges-st-pierre'))` (fixed player, **not** a roster draft). Four bands (see Task 3).
- `src/domain/combat/opponent.ts` — `targetRating(fightNumber)` (currently `min(73, 63 + fightNumber)`) and `generateOpponent` (procedural; archetype base shifted to hit `targetRating`, re-centered to ±1). Opponents are **procedural** — they do NOT draw from the roster.
- `src/domain/combat/finish.ts` — finish constants `COMMIT_P`, `MEASURE_P`, `INITIAL_STEPS`, `ROCKED_HEAD_DMG(chin)`.
- `src/domain/combat/resolve.ts` — round resolution; `DMG_FACTOR` and the rocked/finish-window logic.

**What M9 does NOT change:** the combat engine's algorithms/exports, the draft state machine, persistence, any screen or component, `App.tsx`. No engine behavior changes — only roster data and tuning constants (+ their tests).

**Why roster expansion needs a test-hardening step first:** `rollFighter` uses `pick(rng, pool)` = `pool[floor(rng()*pool.length)]`. Changing `pool.length` (adding fighters) changes which fighter a given seed rolls. Exactly one test asserts a seed→specific-fighter mapping: `src/components/RolledFighterCard.test.tsx:12` expects `startDraft('title-run')` to show **"Khabib Nurmagomedov"**. That assertion will break when the roster grows. Task 1 de-brittles it (derive the expected name from the domain) **before** the roster changes, so the suite stays green throughout. (The balance/integration harnesses reference GSP **by id** via `getFighter('georges-st-pierre')`, which is stable — no change needed there.)

## File Map

- `src/components/RolledFighterCard.test.tsx` — **Task 1**: de-hardcode the seed→fighter assertion (derive expected name from the domain).
- `src/domain/combat/roster.ts` — **Task 2**: append 32 fighters to `STARTER_ROSTER` (8 → 40). No signature-overlay/roll logic changes.
- `src/domain/combat/roster.test.ts` — **Task 2**: strengthen invariants (count 40, all 5 archetypes, ≥6 per archetype, unique ids, ≥2 weak, all stat lines valid, GSP present).
- `src/domain/combat/opponent.ts` — **Task 3**: retune `targetRating` (and, if needed, the shift logic) to widen bands.
- `src/domain/combat/resolve.ts` — **Task 3**: retune `DMG_FACTOR` if needed.
- `src/domain/combat/finish.ts` — **Task 3**: retune `COMMIT_P`/`MEASURE_P`/`INITIAL_STEPS`/`ROCKED_HEAD_DMG` if needed.
- `src/domain/combat/balance.test.ts` — **Task 3**: strengthen the four band assertions (never weaken).
- `src/domain/combat/opponent.test.ts` — **Task 3**: keep its invariants green (monotonic ladder, ≤90 cap, span, ±2 realized average). Adjust only if a strengthened numeric expectation is a direct, correct consequence of a tuning change (never to paper over a regression).

---

### Task 1: De-hardcode the seed→fighter test assertion

**Files:**
- Modify/Test: `src/components/RolledFighterCard.test.tsx`

**Interfaces:**
- Consumes: `startDraft(seed)` → `DraftState` with `current: { fighterId, statLine } | null`; `getFighter(id)` → `Fighter { name, ... }`. Both already exported from `../domain/combat`.
- Produces: nothing new — this is a test-only robustness change so the suite survives roster growth (and resolves the reviewer's "hardcoded fighter name is brittle" note).

- [ ] **Step 1: Audit for seed-dependent fighter assertions**

Search the test suite for any assertion that hard-codes which fighter a seed rolls:

```bash
grep -rnE "Khabib|Adesanya|Oliveira|St-Pierre|Ngannou|Holloway|Maia|getByRole\('heading'" src --include=*.test.tsx --include=*.test.ts
```

Expected: the only seed→fighter hardcode is `src/components/RolledFighterCard.test.tsx` line ~12 (`/khabib nurmagomedov/i` for `startDraft('title-run')`). `balance.test.ts` and `integration.test.ts` reference GSP **by id** (`getFighter('georges-st-pierre')`) — those are stable, leave them. If the grep surfaces any other seed→name assertion, apply the same derive-from-domain fix to it in this task.

- [ ] **Step 2: Rewrite the assertion to derive the expected name from the domain**

Replace the hardcoded heading assertion so it computes the expected fighter from the same seed via the engine, rather than a literal. Edit the first test:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RolledFighterCard from './RolledFighterCard';
import { startDraft, keepStat, suggestedStatId, getFighter } from '../domain/combat';

describe('RolledFighterCard', () => {
  it('shows the current fighter and keeps a stat on click', async () => {
    const onKeep = vi.fn();
    const state = startDraft('title-run');
    // Derive the expected fighter from the domain so this test is robust to
    // roster changes (a literal name couples the test to the RNG/roster snapshot).
    const expectedName = getFighter(state.current!.fighterId).name;
    render(<RolledFighterCard state={state} onKeep={onKeep} />);
    expect(screen.getByRole('heading', { name: expectedName })).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('suggested-stat'));
    expect(onKeep).toHaveBeenCalledWith(suggestedStatId(state));
  });

  it('renders already-filled slots as non-interactive', () => {
    const state = keepStat(startDraft('title-run'), 'submissions');
    render(<RolledFighterCard state={state} onKeep={() => {}} />);
    expect(screen.getByTestId('filled-stat-submissions')).toBeInTheDocument();
  });
});
```

Note: `getByRole('heading', { name })` accepts a string for an exact (case-insensitive-normalized) accessible-name match; deriving `expectedName` keeps the assertion meaningful without coupling to a specific roster entry.

- [ ] **Step 3: Run the file to verify it passes on the current 8-fighter roster**

Run: `npx vitest run src/components/RolledFighterCard.test.tsx`
Expected: PASS (2 tests). It now asserts against whatever fighter `title-run` rolls, decoupled from the literal.

- [ ] **Step 4: Run the full suite to confirm nothing else regressed**

Run: `npx vitest run`
Expected: PASS (same total as `main`, currently 152).

- [ ] **Step 5: Commit**

```bash
git add src/components/RolledFighterCard.test.tsx
git commit -m "test(draft): derive expected rolled fighter from the domain (roster-robust)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Expand the roster to 40 real fighters

**Files:**
- Modify: `src/domain/combat/roster.ts` (append to `STARTER_ROSTER`)
- Test: `src/domain/combat/roster.test.ts`

**Interfaces:**
- Consumes: `Fighter { id: string; name: string; archetype: ArchetypeId; signature: Partial<StatLine> }`; `buildStatLine`, `ARCHETYPES`, `ARCHETYPE_IDS`, `STAT_IDS`.
- Produces: a 40-entry `STARTER_ROSTER` covering all five archetypes with at least 6 per archetype and at least two deliberately-weak fighters. `getFighter`/`rollFighter`/`buildStatLine` signatures are unchanged.

- [ ] **Step 1: Write the strengthened roster invariants (RED)**

Replace the body of `src/domain/combat/roster.test.ts` with:

```ts
import { describe, it, expect } from 'vitest';
import { STARTER_ROSTER, buildStatLine, rollFighter, getFighter } from './roster';
import { ARCHETYPE_IDS } from './archetypes';
import { STAT_IDS } from './stats';
import { createRng } from '../rng';

const avg = (f: (typeof STARTER_ROSTER)[number]) => {
  const line = buildStatLine(f);
  return STAT_IDS.reduce((s, k) => s + line[k], 0) / STAT_IDS.length;
};

describe('starter roster', () => {
  it('has 40 fighters with unique ids', () => {
    expect(STARTER_ROSTER).toHaveLength(40);
    const ids = STARTER_ROSTER.map((f) => f.id);
    expect(new Set(ids).size).toBe(40);
  });

  it('covers all five archetypes with at least six fighters each', () => {
    for (const arch of ARCHETYPE_IDS) {
      const count = STARTER_ROSTER.filter((f) => f.archetype === arch).length;
      expect(count).toBeGreaterThanOrEqual(6);
    }
    // every fighter has a known archetype
    for (const f of STARTER_ROSTER) expect(ARCHETYPE_IDS).toContain(f.archetype);
  });

  it('includes at least two deliberately-weak gatekeepers (avg < 60)', () => {
    const weak = STARTER_ROSTER.filter((f) => avg(f) < 60);
    expect(weak.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps every built stat line within the 1..99 scale', () => {
    for (const f of STARTER_ROSTER) {
      const line = buildStatLine(f);
      for (const k of STAT_IDS) {
        expect(line[k]).toBeGreaterThanOrEqual(1);
        expect(line[k]).toBeLessThanOrEqual(99);
      }
    }
  });

  it('retains Georges St-Pierre by id (balance/integration harness depends on it)', () => {
    expect(() => getFighter('georges-st-pierre')).not.toThrow();
  });

  it('rollFighter is deterministic per seed and can exclude', () => {
    const a = rollFighter(createRng('s#0'));
    const b = rollFighter(createRng('s#0'));
    expect(a.id).toBe(b.id);
    const c = rollFighter(createRng('s#0'), [a.id]);
    expect(c.id).not.toBe(a.id);
  });

  it('supports a full 9-slot draft with no repeated source fighter', () => {
    // With 40 fighters the exclude-pool never exhausts before 9 rolls.
    let excluded: string[] = [];
    for (let i = 0; i < 9; i++) {
      const f = rollFighter(createRng(`draft#${i}`), excluded);
      expect(excluded).not.toContain(f.id);
      excluded = [...excluded, f.id];
    }
    expect(excluded.length).toBe(9);
  });
});
```

- [ ] **Step 2: Run to verify it fails (RED)**

Run: `npx vitest run src/domain/combat/roster.test.ts`
Expected: FAIL — the length/archetype-count/weak-count assertions fail against the 8-fighter roster.

- [ ] **Step 3: Append the 32 new fighters to `STARTER_ROSTER`**

In `src/domain/combat/roster.ts`, keep the 8 existing entries and add the following inside the `STARTER_ROSTER` array (before the closing `]`). Signatures follow the existing convention — list only the standout stats; every other stat falls back to the archetype base via `buildStatLine`.

```ts
  // ── Strikers ──────────────────────────────────────────────────────────────
  { id: 'conor-mcgregor',       name: 'Conor McGregor',        archetype: 'striker',    signature: { striking: 94, strikingDef: 74, chin: 60, cardio: 56, takedownDef: 60, fightIQ: 82 } },
  { id: 'anderson-silva',       name: 'Anderson Silva',        archetype: 'striker',    signature: { striking: 95, strikingDef: 90, fightIQ: 88, chin: 66, submissionDef: 62 } },
  { id: 'jose-aldo',            name: 'José Aldo',             archetype: 'striker',    signature: { striking: 92, strikingDef: 82, takedownDef: 86, cardio: 74, chin: 76 } },
  { id: 'alexander-volkanovski', name: 'Alexander Volkanovski', archetype: 'striker',   signature: { striking: 90, strikingDef: 84, cardio: 92, takedownDef: 84, chin: 78, fightIQ: 88 } },
  { id: 'robert-whittaker',     name: 'Robert Whittaker',      archetype: 'striker',    signature: { striking: 88, strikingDef: 82, cardio: 86, chin: 78, fightIQ: 82 } },
  { id: 'sean-omalley',         name: "Sean O'Malley",         archetype: 'striker',    signature: { striking: 88, strikingDef: 80, chin: 56, cardio: 66, fightIQ: 72 } },
  { id: 'petr-yan',             name: 'Petr Yan',              archetype: 'striker',    signature: { striking: 88, strikingDef: 82, takedownDef: 80, cardio: 84, fightIQ: 82 } },
  // ── Wrestlers ─────────────────────────────────────────────────────────────
  { id: 'kamaru-usman',         name: 'Kamaru Usman',          archetype: 'wrestler',   signature: { takedowns: 88, takedownDef: 86, striking: 78, cardio: 84, chin: 78, fightIQ: 82 } },
  { id: 'colby-covington',      name: 'Colby Covington',       archetype: 'wrestler',   signature: { takedowns: 88, takedownDef: 82, cardio: 92, striking: 70, chin: 74 } },
  { id: 'daniel-cormier',       name: 'Daniel Cormier',        archetype: 'wrestler',   signature: { takedowns: 90, takedownDef: 84, striking: 76, chin: 82, submissionDef: 76, fightIQ: 84 } },
  { id: 'henry-cejudo',         name: 'Henry Cejudo',          archetype: 'wrestler',   signature: { takedowns: 90, takedownDef: 86, striking: 80, cardio: 84, fightIQ: 84 } },
  { id: 'islam-makhachev',      name: 'Islam Makhachev',       archetype: 'wrestler',   signature: { takedowns: 90, takedownDef: 86, submissions: 82, cardio: 84, fightIQ: 84 } },
  { id: 'cain-velasquez',       name: 'Cain Velasquez',        archetype: 'wrestler',   signature: { takedowns: 90, takedownDef: 82, striking: 78, cardio: 90, chin: 74 } },
  { id: 'chael-sonnen',         name: 'Chael Sonnen',          archetype: 'wrestler',   signature: { takedowns: 88, takedownDef: 74, cardio: 82, striking: 64, submissionDef: 50, chin: 72 } },
  { id: 'matt-hughes',          name: 'Matt Hughes',           archetype: 'wrestler',   signature: { takedowns: 88, takedownDef: 80, striking: 68, cardio: 80, submissions: 64 } },
  // ── Grapplers ─────────────────────────────────────────────────────────────
  { id: 'nate-diaz',            name: 'Nate Diaz',             archetype: 'grappler',   signature: { submissions: 84, submissionDef: 78, striking: 74, cardio: 88, chin: 82 } },
  { id: 'bj-penn',              name: 'BJ Penn',               archetype: 'grappler',   signature: { submissions: 88, submissionDef: 84, striking: 80, takedownDef: 82, fightIQ: 78 } },
  { id: 'fabricio-werdum',      name: 'Fabrício Werdum',       archetype: 'grappler',   signature: { submissions: 90, submissionDef: 80, striking: 72, takedowns: 74, chin: 64 } },
  { id: 'frank-mir',            name: 'Frank Mir',             archetype: 'grappler',   signature: { submissions: 88, submissionDef: 74, striking: 70, chin: 62 } },
  { id: 'ronaldo-souza',        name: 'Ronaldo Souza',         archetype: 'grappler',   signature: { submissions: 90, submissionDef: 80, takedowns: 80, striking: 72, chin: 66 } },
  { id: 'brian-ortega',         name: 'Brian Ortega',          archetype: 'grappler',   signature: { submissions: 88, submissionDef: 78, striking: 78, chin: 76, cardio: 80 } },
  // ── All-rounders ──────────────────────────────────────────────────────────
  { id: 'jon-jones',            name: 'Jon Jones',             archetype: 'allrounder', signature: { striking: 88, strikingDef: 84, takedowns: 86, takedownDef: 88, submissions: 76, submissionDef: 80, cardio: 84, chin: 82, fightIQ: 94 } },
  { id: 'stipe-miocic',         name: 'Stipe Miocic',          archetype: 'allrounder', signature: { striking: 82, takedowns: 78, takedownDef: 82, cardio: 86, chin: 82, fightIQ: 82 } },
  { id: 'frankie-edgar',        name: 'Frankie Edgar',         archetype: 'allrounder', signature: { striking: 80, takedowns: 82, takedownDef: 80, cardio: 90, chin: 82, fightIQ: 82 } },
  { id: 'tj-dillashaw',         name: 'TJ Dillashaw',          archetype: 'allrounder', signature: { striking: 84, strikingDef: 82, takedowns: 76, cardio: 86, fightIQ: 82 } },
  { id: 'dominick-cruz',        name: 'Dominick Cruz',         archetype: 'allrounder', signature: { striking: 76, strikingDef: 88, takedowns: 78, takedownDef: 82, cardio: 86, fightIQ: 90 } },
  { id: 'leon-edwards',         name: 'Leon Edwards',          archetype: 'allrounder', signature: { striking: 84, strikingDef: 82, takedownDef: 80, cardio: 82, chin: 78, fightIQ: 82 } },
  // ── Brawlers ──────────────────────────────────────────────────────────────
  { id: 'justin-gaethje',       name: 'Justin Gaethje',        archetype: 'brawler',    signature: { striking: 92, chin: 82, cardio: 78, strikingDef: 56, takedownDef: 74, fightIQ: 66 } },
  { id: 'robbie-lawler',        name: 'Robbie Lawler',         archetype: 'brawler',    signature: { striking: 90, chin: 88, strikingDef: 60, cardio: 76 } },
  { id: 'derrick-lewis',        name: 'Derrick Lewis',         archetype: 'brawler',    signature: { striking: 90, chin: 86, strikingDef: 46, cardio: 42, takedownDef: 48, fightIQ: 50 } },
  { id: 'mark-hunt',            name: 'Mark Hunt',             archetype: 'brawler',    signature: { striking: 90, chin: 90, strikingDef: 52, cardio: 46, takedowns: 28, takedownDef: 60 } },
  // deliberately weak gatekeeper (avg < 60) — an easy early-ladder draw and a cautionary draft
  { id: 'rudy-kane',            name: 'Rudy "Last Call" Kane', archetype: 'brawler',    signature: { striking: 52, strikingDef: 42, takedowns: 40, takedownDef: 44, submissions: 36, submissionDef: 42, cardio: 48, chin: 56, fightIQ: 44 } },
```

Final composition (with the 8 existing): striker 9, wrestler 9, grappler 8, allrounder 7, brawler 7 = **40**; weak (avg < 60): `journeyman-doe` + `rudy-kane`.

- [ ] **Step 4: Run the roster tests to green**

Run: `npx vitest run src/domain/combat/roster.test.ts`
Expected: PASS (all invariants).

- [ ] **Step 5: Run the full suite (roster growth must not regress anything)**

Run: `npx vitest run`
Expected: PASS. Task 1 already de-brittled the one seed→fighter assertion; the balance/integration harnesses use GSP by id and are unaffected. If any other test fails because it implicitly assumed the 8-fighter roster, fix it by deriving the expectation from the domain (same pattern as Task 1) — do NOT re-hardcode.

- [ ] **Step 6: tsc + build**

Run: `npx tsc --noEmit && npx vite build`
Expected: clean; build ok.

- [ ] **Step 7: Commit**

```bash
git add src/domain/combat/roster.ts src/domain/combat/roster.test.ts
git commit -m "feat(roster): expand draft pool to 40 real fighters across all archetypes

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Final balance tuning — widen the tight margins

> **DEFERRED to the M10 combat-decision-redesign milestone — not implemented in this PR (roster-only).**
>
> The combat decision model is being redesigned in M10 (style-aware round decisions + wrestle→ground-and-pound/submission), which re-measures and re-tunes these bands from scratch against a new decision tree. Tuning the current striking-only model now would be thrown away and touches the same files (`resolve.ts`, `finish.ts`, `balance.test.ts`, `opponent.ts`). Roster (Tasks 1–2) is fully decoupled from balance (the harness uses a fixed GSP player + procedural opponents), so this PR ships roster-only with the existing `main` balance assertions unchanged and green.

**Files:**
- Modify (as needed): `src/domain/combat/opponent.ts`, `src/domain/combat/resolve.ts`, `src/domain/combat/finish.ts`
- Test: `src/domain/combat/balance.test.ts` (strengthen), `src/domain/combat/opponent.test.ts` (keep green)

**Interfaces:**
- Consumes: the existing balance harness (`simulate(fightNumber, policy)` → `Band { winRate, finishRate }`, fixed `PLAYER = buildStatLine(getFighter('georges-st-pierre'))`, `good`/`careless` policies).
- Produces: no new symbols. Tightened band thresholds + retuned constants. `generateOpponent`/`targetRating` signatures unchanged.

**Current bands (measured on `main`, for reference):** finish rate (avg fights 1–10) ≈ 0.279; careless@1 ≈ 0.77; good@1 ≈ 0.99; good@9 ≈ 0.53; good@10 ≈ 0.47; win curve declines 0.99→…→0.47. The bands pass but the margins are tight — this task widens them.

**Tuning discipline (read carefully):**
- **RED-first:** strengthen the assertions first and watch the relevant band go RED, then tune constants to GREEN.
- **Never weaken.** Do not reduce any assertion below its current `main` value, and do not weaken any assertion to make a change pass. The tuning knobs are: `targetRating(fightNumber)` shape (currently `min(73, 63 + fightNumber)`), `DMG_FACTOR` (`resolve.ts`), `ROCKED_HEAD_DMG(chin)` and `COMMIT_P`/`MEASURE_P`/`INITIAL_STEPS` (`finish.ts`).
- **Achievable-floor rule:** aim for the target margins below. If a specific target proves unreachable without pushing another band red, set that one assertion to the **best value you actually and stably achieve** — which must still be **≥ its original `main` floor**. This guarantees the milestone always lands (worst case: margins and assertions unchanged) while pushing for improvement. Re-run each band over the full seed set to confirm stability (no flakiness).
- **Keep `opponent.test.ts` green:** the ladder must stay monotonic non-decreasing in `fightNumber`, cap ≤ 90, keep its span invariant, and the realized average must stay within ±2 of `targetRating`. If a tuning change legitimately shifts a numeric expectation there, update it to the correct new value — never to hide a regression.
- **No `Math.random`; determinism preserved.**

- [ ] **Step 1: Strengthen the four band assertions (RED)**

In `src/domain/combat/balance.test.ts`, tighten the assertions to these target margins (each is ≥ the current floor):

```ts
  it('BAND 1 — finishes are attainable: good play finishes >= 30% of all fights', () => {
    const totalFinishRate =
      good.slice(1).reduce((sum, b) => sum + b.finishRate, 0) / 10;
    expect(totalFinishRate).toBeGreaterThanOrEqual(0.30); // was 0.25
  });

  it('BAND 2 — early decisions matter: careless is genuinely punished, good play dominates', () => {
    expect(careless[1].winRate).toBeLessThanOrEqual(0.72);                       // was 0.80 — punish carelessness harder
    expect(good[1].winRate).toBeGreaterThan(0.8);
    expect(good[1].winRate - careless[1].winRate).toBeGreaterThanOrEqual(0.20);  // was 0.15
  });

  it('BAND 3 — no wall: late fights stay winnable with good play', () => {
    expect(good[9].winRate).toBeGreaterThanOrEqual(0.45);   // was 0.40
    expect(good[10].winRate).toBeGreaterThanOrEqual(0.45);  // was 0.40
    expect(good[9].winRate).toBeGreaterThan(0);
    expect(good[10].winRate).toBeGreaterThan(0);
  });

  it('BAND 4 — no runaway: difficulty rises with fightNumber (no snowball)', () => {
    const early = (good[1].winRate + good[2].winRate) / 2;
    const late = (good[9].winRate + good[10].winRate) / 2;
    expect(late).toBeLessThanOrEqual(early);
    expect(late).toBeLessThan(0.9);
  });
```

- [ ] **Step 2: Run the bands to see which are RED**

Run: `npx vitest run src/domain/combat/balance.test.ts`
Expected: one or more of BAND 1/2/3 FAIL against the current constants (they were passing only with slack).

- [ ] **Step 3: Tune constants to green**

Adjust the tuning knobs (small steps, re-measure after each) to satisfy the strengthened bands simultaneously:
- To **raise the finish rate** (BAND 1): increase `DMG_FACTOR` slightly and/or make `ROCKED_HEAD_DMG(chin)` harsher (lower the chin multiplier) and/or raise `COMMIT_P`/`INITIAL_STEPS` so opened windows convert more often.
- To **punish careless play harder at fight 1** (BAND 2, careless ≤ 0.72) without dropping good@1 below 0.8: raise the **early** opponent floor (e.g., lift the `targetRating` intercept for low `fightNumber`) so a reckless, gas-out-the-head plan loses more often, while good play (targets weak defense, manages stamina) still wins.
- To **keep late fights winnable** (BAND 3, good@9/@10 ≥ 0.45): soften the **late** end of the ladder (e.g., lower the `targetRating` cap or flatten its late slope) so good play clears ~45%+, while BAND 4 still holds (late ≤ early, late < 0.9).

Keep every `opponent.test.ts` invariant green as you go (`npx vitest run src/domain/combat/opponent.test.ts`).

- [ ] **Step 4: Run the balance + opponent suites to green (stable)**

Run: `npx vitest run src/domain/combat/balance.test.ts src/domain/combat/opponent.test.ts`
Expected: PASS. Re-run once more to confirm stability (deterministic — should be identical):
Run again: `npx vitest run src/domain/combat/balance.test.ts`
Expected: PASS (identical).

If a target band could not be pushed to its strengthened value without forcing another band red, back that single assertion off to the best stable value you achieved (still ≥ its original `main` floor per the Achievable-floor rule), leave a one-line comment noting the achieved margin, and keep the others strengthened.

- [ ] **Step 5: Full gate**

Run: `npx vitest run && npx tsc --noEmit && npx vite build`
Expected: all tests PASS; tsc clean; build ok.

- [ ] **Step 6: Commit**

```bash
git add src/domain/combat/opponent.ts src/domain/combat/resolve.ts src/domain/combat/finish.ts src/domain/combat/balance.test.ts src/domain/combat/opponent.test.ts
git commit -m "balance(combat): widen difficulty margins (finishes, early punishment, late winnability)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
```

(Only stage the files you actually changed.)

---

## Verification & Rollout (for the orchestrator, after all tasks)

1. **Gate on final HEAD:** `npx vitest run` (all green; count > 152), `npx tsc --noEmit` (clean), `npx vite build` (ok). No `Math.random` in `src/` (`grep -rn "Math.random" src` → none). No new deps (package.json/lockfile unchanged).
2. **Scope check:** the diff touches only `src/domain/combat/roster.ts`, `roster.test.ts`, `opponent.ts`, `opponent.test.ts`, `resolve.ts`, `finish.ts`, `balance.test.ts`, and `src/components/RolledFighterCard.test.tsx` (+ this plan doc). No engine-API, screen, `App.tsx`, or persistence changes.
3. **Per-commit trailer audit:** every commit ends with the exact `Co-authored-by: Copilot App <…>` trailer (with "App").
4. **Open one PR into `main`**, push, verify `HEAD == @{u}` and CI `build-and-test` green. **Do NOT merge** — hand to the orchestrator for the GPT-5.5 xhigh + Copilot review pipeline, then merge + deploy to Pages.

## Self-Review (against the M8 design spec §2/§13 M9 scope)

- **Spec coverage:** M9 = "the full 45–60+ real-fighter roster" → Task 2 broadens to 40 real fighters across all archetypes (a strong, curated pool; count kept at a clean, tunable 40 rather than padding to 60 with filler). "Final tuning against the locked M8 model" → Task 3 widens the tight bands. Roster expansion feeding the draft: covered (draft rolls from `STARTER_ROSTER`; no draft-code change needed). Opponents remain the procedural ladder per design §10 (explicit non-goal to make them roster fighters — keeps balance stable). ✓
- **Placeholder scan:** every step has concrete code/commands (full 32-fighter block, full test bodies, exact band numbers, exact knobs). No TBD/TODO. ✓
- **Type consistency:** `Fighter`/`signature: Partial<StatLine>`/`ArchetypeId`/`STAT_IDS`/`buildStatLine`/`getFighter`/`rollFighter` all match `roster.ts`/`archetypes.ts`/`stats.ts`. `DraftState.current.fighterId` matches `draft.ts`. Band symbols (`good`/`careless`/`winRate`/`finishRate`) match `balance.test.ts`. ✓
- **Decoupling guarantee:** balance harness uses fixed GSP (by id) → roster growth cannot move bands; Task 2 and Task 3 are independent and can be reviewed independently. ✓
