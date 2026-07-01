# M5: Fight UI — Design Spec

**Date:** 2026-07-01
**Milestone:** M5 (Fight UI)
**Status:** Design — awaiting user review
**Depends on:** M4 Fight Engine (merged, `dea1c42`) — pure domain in `src/domain/fight.ts` + `src/domain/opponent.ts`

---

## 1. Goal & Why

Replace the placeholder `FightScreen` ("Fight — coming soon") with a **playable, reference-accurate fight loop**: the player fights a full bout round-by-round by choosing a tactical intent each round, watches health deplete, and sees an outcome (KO / submission / decision). This is the **presentation layer over the already-merged M4 engine** — it proves the engine works through real UI before run/streak state (M6) exists.

**Why now:** M4 shipped a fully-tested pure fight engine with no way to play it. M5 makes it tangible and lets us validate feel (the "measured," telegraphed combat) in the browser. It also de-risks M6 by settling the fight screen's component structure first.

---

## 2. Scope Boundary (LOCKED)

**In scope:**
- A single interactive **Fight screen** rendered by `App` with **no props** (same pattern as `DraftScreen`).
- Player fights with a **fixed, strong, well-rounded demo fighter** baked into the screen.
- Round-by-round intent selection driving `resolveRound`; health/round display; end-of-fight result.
- **"New fight"** button that starts a fresh bout; the **fight number increments each time** (fight 1 → 2 → 3…), previewing the difficulty climb. Opponents scale up accordingly.
- Fold in the carryover **`StatBar` `aria-label`** accessibility nit (M2 review) since the fight UI reuses meter-style bars.

**Out of scope (explicitly deferred):**
- **M6:** threading the real drafted fighter into the fight; run/streak state; rewards; permadeath; next-opponent progression tied to a run; persistence. Also the M6 engine nit (round-roll `#r${round}` stream independent of `fightNumber`).
- No new dependencies. No `Math.random` in logic that feeds the engine — the **seed is the only randomness source** (determinism preserved).
- No changes to `src/domain/**` engine logic (consume it as-is via the `src/domain` barrel). The only non-UI change is the `StatBar` aria-label nit.

---

## 3. Design Language

Follow the canonical **"Octagon Elite"** `tactical-intent` reference (`docs/design/screens/tactical-intent/mockup.html`) and the merged theme tokens (`src/theme/tokens.ts`). Dark charcoal canvas, Championship Gold primary (`#f2ca50` / container `#d4af37`), Octagon Blood Red secondary (`#ffb4ac` / container `#960711`) for the opponent/danger, sharp edges, Anton (display, uppercase) / Archivo Narrow (body) / Space Mono (stats & caps). This mockup was reviewed and approved during brainstorming.

---

## 4. Screen Structure

Top-to-bottom (the M1 `TopAppBar` / `BottomNavBar` already wrap the screen via `App`):

1. **Fight header** — Anton gold-glow title (e.g. `FIGHT 1 · OCTAGON DEBUT`) + a caps sub-line showing **`ROUND {round} OF {rounds}`**. Faint octagon silhouette background.
2. **Fighter comparison — two chiaroscuro cards** side by side (stacked on mobile):
   - **Opponent card** (blood-red right accent): generated name, `{STYLE} · CHALLENGER` sub-label, pulsing **DANGER** badge, **segmented health bar**, and a one-line **"read"** (telegraph) describing the opponent's threat/weakness in plain language derived from its style + stats.
   - **Player card** (gold left accent): demo fighter name (`YOUR FIGHTER`), `YOU` badge, segmented health bar.
   - Health for each = `1 − damage / durability(statLine)`, clamped to `[0, 1]`; `durability` is the M4 export.
3. **Tactical intents** (only while `status === 'in-progress'`):
   - **Hero STRIKE** button (gold) showing its offense pair (BOXING / KICKS) values from the player's stat line, tagged `★ CAN FINISH`.
   - **2×2 grid**: Clinch, Takedown, Submit, Out-point — each a chiaroscuro card with a Material-style icon and its **real engine offense pair** values; **★ marks the three finish-capable intents** (Strike, Clinch, Submit). Takedown & Out-point are visibly "win rounds, never finish."
4. **Result state** (replaces the intent panel when `status !== 'in-progress'`): headline outcome (`KO` / `SUBMISSION` / `DECISION`), the round it happened, and winner (`YOU WIN` / `YOU LOSE`), plus a **NEW FIGHT** button.

---

## 5. State & Data Flow

- `FightScreen` owns local React state: the current `FightState` and the current `fightNumber` (starts at `1`).
- **Seed:** an optional `seed` prop (default captured once at mount from `Date.now().toString()`, mirroring `DraftScreen`). Tests inject a fixed seed for determinism. `Math.random` is never used.
- **Demo fighter:** a module-level constant `StatLine` — strong, well-rounded. Uses the M4 reference build so tests can reuse M4's baked vectors:
  `{ boxing: 82, kicks: 92, clinch: 80, takedowns: 98, submissions: 97, topControl: 88, cardio: 90, chin: 88, fightIQ: 78 }`.
- **Init / new fight:** `startFight({ seed, fightNumber, playerStatLine: DEMO_FIGHTER })`. "New fight" increments `fightNumber` then calls `startFight` again → a new, harder generated opponent (opponent seed is `${seed}#opp${fightNumber}`, so distinct per fight).
- **Round:** clicking an intent calls `resolveRound(state, intent)` and stores the returned state. When the returned `status` is `won`/`lost`, the result panel renders. Intents are disabled/hidden once the fight is settled.
- All engine types/functions imported from the `src/domain` barrel: `startFight`, `resolveRound`, `durability`, `INTENTS`, and the `Intent` / `FightState` / `FightOutcome` types.

**The opponent "read":** a small pure helper (in the screen or a `fightCopy.ts` util) maps `opponent.style` (+ a couple of stat comparisons) to a short human sentence. Presentational only — never affects the engine. Example: grappler → "Wants it on the mat — big submissions & takedowns, but a suspect chin."

---

## 6. Components (new — each small, focused, independently testable)

- **`FighterHealthCard.tsx`** — presentational. Props: `{ side: 'player' | 'opponent'; name: string; subtitle: string; badge: string; healthPct: number; read?: string }`. Renders the chiaroscuro card, badge, and a **segmented health bar** with proper a11y (`role="meter"`, `aria-valuenow`, `aria-valuemin/max`, `aria-label="{name} health"`).
- **`IntentPanel.tsx`** — props: `{ statLine: StatLine; onIntent: (intent: Intent) => void; disabled?: boolean }`. Renders the hero Strike + 2×2 grid, pulling each intent's offense pair from `INTENTS[intent].offense` and displaying the player's values. Marks finish-capable intents (where `INTENTS[intent].finish !== null`) with ★. Buttons call `onIntent`.
- **`FightResultPanel.tsx`** — props: `{ outcome: FightOutcome; onNewFight: () => void }`. Shows method/round/winner and the NEW FIGHT button.
- **`FightScreen.tsx`** — orchestrates state and composes the three above + the header. Replaces the placeholder. Reuses M1 theme utilities.

Reuse existing M1 components where natural (e.g. `StatBar` styling conventions); do not duplicate the design system.

---

## 7. Testing (Vitest + RTL, strict TDD)

Per-component unit tests plus a screen-level integration test:

- **`FighterHealthCard`**: given `healthPct`, renders a meter with correct `aria-valuenow`; shows name/badge/read.
- **`IntentPanel`**: renders all five intents with the correct offense-pair values from a given stat line; ★ appears on exactly Strike/Clinch/Submit; clicking calls `onIntent` with the right `Intent`; `disabled` suppresses clicks.
- **`FightResultPanel`**: renders method/round/winner text; NEW FIGHT click fires `onNewFight`.
- **`FightScreen` integration (deterministic, fixed seed):**
  - Rendered with `seed="run-42"` → opponent card shows **`Hideo "Granite" Stone`** and `ROUND 1 OF 3` (reuses M4 baked opponent vector).
  - Clicking **Strike** three times plays out the exact M4 baked bout → result panel shows a **DECISION win** (M4 vector: dom 30/40/25, oppDmg 18/42/57, no finish → player wins all rounds).
  - After the win, **NEW FIGHT** advances to fight 2 → header shows `ROUND 1 OF 3` again and a **different** opponent name (fight number incremented; distinct opponent seed).
  - A11y: health meters have accessible names; intent buttons are reachable.
- **`StatBar`**: add/adjust a test asserting the new `aria-label` gives the `role="meter"` an accessible name (folds the M2 nit).

All engine determinism is inherited from M4 — these tests assert the **UI faithfully reflects** engine state, not new engine math.

---

## 8. Files

**Create:**
- `src/screens/FightScreen.tsx` (replaces placeholder body) + `src/screens/FightScreen.test.tsx`
- `src/components/FighterHealthCard.tsx` + `.test.tsx`
- `src/components/IntentPanel.tsx` + `.test.tsx`
- `src/components/FightResultPanel.tsx` + `.test.tsx`
- (optional) `src/screens/fightCopy.ts` + `.test.ts` for the opponent "read" helper

**Modify:**
- `src/components/StatBar.tsx` + `.test.tsx` — add `aria-label` (M2 nit)
- No `App.tsx` change required (it already renders `<FightScreen />`).

**Untouched:** all of `src/domain/**` engine logic, `package.json`, config, theme tokens.

---

## 9. Carryover Ledger (post-M5)

- **M6:** real drafted fighter → fight handoff; run/streak; rewards; permadeath; persistence; round-roll `#r${round}` stream should fold in `fightNumber`; `DraftScreen` `onComplete`-in-setState-updater + `getDraftedFighter` hoist nits.
- **M7:** persistence & polish.
