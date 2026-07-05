# M15 — Multi-Exchange Rounds + Strike Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn each fight round from a single all-or-nothing decision into a sequence of 3 tactile *exchanges*, each driven by a pick from a real striking palette (jab / power punch / body kick / leg kick / knee / elbow), so damage builds beat-by-beat and every round has texture.

**Architecture:** Today `resolveRound(state, intent)` resolves an ENTIRE round in one call and jumps to `'corner'`. M15 introduces `resolveExchange(state, move)` — one *beat* per call — and an `exchange` counter on `FightState`. The two-sided dominance math is reused verbatim; only the per-side offense/defense multipliers, stamina cost, damage weight and target now come from a chosen **StrikeProfile** instead of the old 3-value `StrikeTactic`. The Corner (M14) game plan still supplies the round-level *tone* (atk/def/stamina modifiers). Wrestle stays interim (a `takedown` move routes to the existing ground-window that cashes out the round; M16 replaces it with the full ground tree). Stamina **cost** is charged per beat; stamina **recovery** + game-plan stamina delta apply once per round at the round boundary — this keeps the M14 stamina economy intact and is the single most balance-sensitive decision, which Task 7 (the balance gate) validates empirically.

**Tech Stack:** React 18 + TypeScript (strict) + Vite + Tailwind; Vitest + React Testing Library; localStorage persistence; seeded RNG via `src/domain/rng.ts` (`createRng`).

## Global Constraints

- **No `Math.random`** anywhere in `src/`. All randomness comes from `createRng(key)` with a deterministic string key. New per-beat keys: exchange swing `` `${seed}#f${fightNumber}#r${round}#x${exchange}` ``; opponent move `` `${seed}#f${fightNumber}#ai${round}#x${exchange}` ``.
- **No new runtime or dev dependencies.** `package.json` and `package-lock.json` must be byte-identical to `origin/main` at the end (`git diff --stat origin/main -- package.json package-lock.json` → empty).
- **TypeScript strict** — no `any`, no non-null `!` on possibly-undefined, no unused symbols (build runs `tsc --noEmit`).
- **Determinism** — the full `vitest run` suite must pass **twice with identical counts**. Same seed + same moves ⇒ byte-identical `FightState`.
- **Every commit** ends with exactly this trailer (one blank line before it):
  `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`
- **Scope fence:** M15 does NOT touch the draft, the roster, `bestReign`, the run-over/championship flow, or the M16 ground tree / M17 signatures. It DOES touch: `src/domain/combat/*`, `src/persistence/runStorageV2.ts`, `src/fightDisplay.ts`, `src/screens/FightView.tsx`, `src/App.tsx`, and combat UI components.
- **Balance is load-bearing.** Task 7's bands are the gate; a wave that ships with regressed skill-separation or a revived pressure-exploit is a failed wave. Tune only the NEW knobs (strike-profile numbers, `EXCHANGES_PER_ROUND`), never weaken a band to pass.
- **ONE PR** into `main`, titled `M15: multi-exchange rounds + strike palette`. Do **not** merge. Report back.

---

## File Structure

**New files:**
- `src/domain/combat/strikes.ts` — the strike palette: `StrikeId`, `StrikeTarget`, `StrikeProfile`, `STRIKES` table, `STRIKE_PALETTE`, `strikeProfile(id)`. Pure data + accessor.
- `src/domain/combat/strikes.test.ts`
- `src/domain/combat/exchange.ts` — `resolveExchange(state, move)`, `EXCHANGES_PER_ROUND`, and the per-beat helpers. (Kept separate from `resolve.ts` so the beat engine is one focused file; `resolve.ts`'s `resolveRound` is retired by re-export — see Task 4.)
- `src/domain/combat/exchange.test.ts`
- `src/components/StrikePanel.tsx` — the palette picker for the `in-round` phase (replaces `IntentPanelV2` in `FightView`).
- `src/components/StrikePanel.test.tsx`

**Modified files:**
- `src/domain/combat/intents.ts` — add `ExchangeMove`, `MoveStrike`, move labels, `movePhase()`, `isTakedown()`. Keep existing `RoundIntent`/`StrikeTactic` exports (still referenced by legacy tests until they're migrated; not deleted in M15).
- `src/domain/combat/fightState.ts` — add `exchange: number` to `FightState`; `legDamage: number` to `Fighter2`; `exchange:1`/`legDamage:0` in factories; `chooseGamePlan` resets `exchange` to 1; `RoundLogEntry` gains `exchange` and its `playerIntent`/`opponentIntent` fields become `ExchangeMove`; rename `opponentIntent`→`opponentMove` returning `ExchangeMove`; redefine `computePredictability` over moves.
- `src/domain/combat/report.ts` — `RoundReportInput.playerIntent`/`opponentIntent` become `ExchangeMove`; rewrite the strike-vocabulary headline branches.
- `src/domain/combat/finish.ts` — every transition that advances `round` / enters `'corner'` or `'finished'` also sets `exchange: 1`.
- `src/domain/combat/stamina.ts` — add `mobilityMultiplier(legDamage)`.
- `src/domain/combat/balance.test.ts` — rewrite `playFight` to drive exchanges + re-derive BANDs (GATE).
- `src/domain/combat/index.ts` — barrel already uses `export *`; add `export * from './strikes';` and `export * from './exchange';`.
- `src/persistence/runStorageV2.ts` — validate `exchange` (int ≥ 1) and `legDamage` (finite); bump `SCHEMA_VERSION` 3 → 4.
- `src/fightDisplay.ts` — add `legPct(f)` + `exchangeLabel(state)` helpers.
- `src/screens/FightView.tsx` — dispatch `onMove` on `in-round`; render `StrikePanel`; expose `data-exchange`.
- `src/App.tsx` — `handleMove` dispatches `resolveExchange` on `in-round`.

---

## Architecture Contract (read before Task 4)

`resolveExchange(state, move)` — **requires `state.phase === 'in-round'`.** One beat:

1. `oppMove = opponentMove(state)` (seeded `#ai${round}#x${exchange}`).
2. `planEffect = gamePlanEffect(state.gamePlan)` (unchanged M14 helper).
3. `seededSwing = (createRng(`${seed}#f${fightNumber}#r${round}#x${exchange}`)() - 0.5) * SWING_RANGE`.
4. Effort per side = `effortMultiplier(stamina) * mobilityMultiplier(legDamage)` (leg damage lowers mobility).
5. Two-sided dominance — **identical formula to `resolveRound`**, but `atkMult`/`defMult`/`counterBonus`/damage-weight/target come from the move's `StrikeProfile` (see Task 1/4). `planEffect.atkMult`/`defMult` still multiply the player's attack/defense.
6. **Branch, in this order:**
   - `move.kind === 'takedown'` AND player wins (`dominance > 0`) → open the existing **ground-window** (`phase:'ground-window'`, `window:{side:'player',method:'ground',stepsLeft:INITIAL_STEPS}`), round NOT advanced, `exchange` frozen. (Interim — cashes out the round via `groundStep`.)
   - `oppMove.kind === 'takedown'` AND opponent wins (`dominance < 0`) → existing opponent-ground branch (submission read / GnP → opponent finish-window or advance). Round handling as today.
   - else **strike exchange:** apply `dmg = round(|dominance| * DMG_FACTOR * winnerStrike.power)` to the loser at the winner strike's `target` (head / body / legs); body drains stamina (`BODY_TO_STAMINA`), legs adds `legDamage`; accrue `roundScore` margin; charge **per-beat stamina cost** only (no recovery yet); build the per-beat `RoundReport`.
     - If this beat crosses a rock/finish threshold (`detectWindow(...)` returns non-null) → `phase:'finish-window'`, round NOT advanced, `exchange` frozen. (Same machinery as today.)
     - else if `exchange < EXCHANGES_PER_ROUND` → stay `'in-round'`, `exchange + 1`, damage/stamina/score accrued, `lastReport` set. **No round advance, no recovery.**
     - else (**last beat of the round**) → **round boundary:** apply `+recovery(statLine) - bodyRecoveryPenalty(bodyDamage) + planEffect.staminaDelta` to BOTH fighters' stamina, then:
       - if `round < rounds` → `phase:'corner'`, `round + 1`, `exchange:1`, `gamePlan:null`, `outcome:null`.
       - else → `phase:'finished'`, `outcome: scoreFight(finalState)`, `round` unchanged, `exchange` unchanged (frozen at EXCHANGES_PER_ROUND).

**Invariant (tested):** `exchange` is `1` in `'corner'` and at `startFight`; it ranges `1..EXCHANGES_PER_ROUND` while `'in-round'`; it is **frozen at its current beat value** in a mid-round `'finish-window'`/`'ground-window'` and in the terminal `'finished'` state (a mid-round rock can finish the fight at beat 2). So only the transition **into `'corner'`** resets `exchange` to `1`.

**Retire `resolveRound`:** the whole-round entry point is removed. `resolve.ts` re-exports `resolveExchange` helpers it shares (`atkMult` etc. move to `exchange.ts` or are shared via a small `exchangeMath.ts` — implementer's call, keep it DRY). App/tests call `resolveExchange`. Legacy `resolve.test.ts` is migrated in Task 4.

---

### Task 0: Commit design + plan docs

**Files:**
- Create: `docs/superpowers/specs/2026-07-04-immersive-fight-overhaul-design.md` (from gist)
- Create: `docs/superpowers/plans/2026-07-04-m15-multi-exchange-strike-palette-plan.md` (this file, from gist)

- [ ] **Step 1: Fetch the two gist files** (design + this plan) and write them verbatim to the paths above.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-07-04-immersive-fight-overhaul-design.md docs/superpowers/plans/2026-07-04-m15-multi-exchange-strike-palette-plan.md
git commit -m "$(cat <<'EOF'
docs(m15): immersive-fight design + M15 multi-exchange plan

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>
EOF
)"
```

---

### Task 1: Strike palette (`strikes.ts`)

**Files:**
- Create: `src/domain/combat/strikes.ts`
- Test: `src/domain/combat/strikes.test.ts`
- Modify: `src/domain/combat/index.ts` (add `export * from './strikes';`)

**Interfaces:**
- Produces:
  - `type StrikeId = 'jab' | 'powerPunch' | 'bodyKick' | 'legKick' | 'knee' | 'elbow'`
  - `type StrikeTarget = 'head' | 'body' | 'legs'`
  - `interface StrikeProfile { id: StrikeId; label: string; blurb: string; target: StrikeTarget; atkMult: number; defMult: number; power: number; staminaCost: number; koWeight: number; speed: number }`
  - `const STRIKES: Record<StrikeId, StrikeProfile>`
  - `const STRIKE_PALETTE: readonly StrikeId[]`
  - `function strikeProfile(id: StrikeId): StrikeProfile`

**Design notes (numbers are Task-7-tunable starting values; do NOT weaken skill separation to pass a band — retune these):**
- `speed` drives the timing/counter read (fast strike defending a slow, high-commit strike earns a bonus — generalises the old pressure↔counter).
- `power` scales exchange damage; `koWeight` feeds head-hunt predictability + finish potency; `defMult` is the exposure you carry *while throwing it*.
- Targets: jab→head, powerPunch→head, bodyKick→body, legKick→legs, knee→body, elbow→head.

- [ ] **Step 1: Write the failing test**

```ts
// src/domain/combat/strikes.test.ts
import { describe, it, expect } from 'vitest';
import { STRIKES, STRIKE_PALETTE, strikeProfile, type StrikeId } from './strikes';

describe('strike palette', () => {
  it('exposes exactly six strikes in the palette', () => {
    expect(STRIKE_PALETTE).toEqual(['jab', 'powerPunch', 'bodyKick', 'legKick', 'knee', 'elbow']);
  });

  it('every palette id has a complete, valid profile', () => {
    for (const id of STRIKE_PALETTE) {
      const p = STRIKES[id];
      expect(p.id).toBe(id);
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.blurb.length).toBeGreaterThan(0);
      expect(['head', 'body', 'legs']).toContain(p.target);
      expect(p.atkMult).toBeGreaterThan(0);
      expect(p.defMult).toBeGreaterThan(0);
      expect(p.power).toBeGreaterThan(0);
      expect(p.staminaCost).toBeGreaterThan(0);
      expect(p.koWeight).toBeGreaterThanOrEqual(0);
      expect(p.speed).toBeGreaterThanOrEqual(0);
      expect(p.speed).toBeLessThanOrEqual(1);
    }
  });

  it('targets are wired as designed', () => {
    expect(STRIKES.jab.target).toBe('head');
    expect(STRIKES.powerPunch.target).toBe('head');
    expect(STRIKES.bodyKick.target).toBe('body');
    expect(STRIKES.legKick.target).toBe('legs');
    expect(STRIKES.knee.target).toBe('body');
    expect(STRIKES.elbow.target).toBe('head');
  });

  it('power punch out-powers the jab but is slower and costs more', () => {
    expect(STRIKES.powerPunch.power).toBeGreaterThan(STRIKES.jab.power);
    expect(STRIKES.powerPunch.speed).toBeLessThan(STRIKES.jab.speed);
    expect(STRIKES.powerPunch.staminaCost).toBeGreaterThan(STRIKES.jab.staminaCost);
  });

  it('strikeProfile returns the table entry', () => {
    const id: StrikeId = 'elbow';
    expect(strikeProfile(id)).toBe(STRIKES.elbow);
  });
});
```

- [ ] **Step 2: Run test → FAIL** (`npx vitest run src/domain/combat/strikes.test.ts`) — "Cannot find module './strikes'".

- [ ] **Step 3: Implement `strikes.ts`**

```ts
// src/domain/combat/strikes.ts
export type StrikeId = 'jab' | 'powerPunch' | 'bodyKick' | 'legKick' | 'knee' | 'elbow';
export type StrikeTarget = 'head' | 'body' | 'legs';

export interface StrikeProfile {
  id: StrikeId;
  label: string;
  blurb: string;
  target: StrikeTarget;
  /** Offensive multiplier on the attacker's striking score. */
  atkMult: number;
  /** Defensive exposure carried WHILE throwing this strike (lower = more open). */
  defMult: number;
  /** Damage weight applied to |dominance| when this strike lands. */
  power: number;
  /** Per-beat stamina charged to throw it. */
  staminaCost: number;
  /** Head-KO potential contribution (also flags head-hunting for the adaptive AI). */
  koWeight: number;
  /** 0..1 — higher = faster; fast strikes read/counter slow, high-commit strikes. */
  speed: number;
}

// Starting values — TUNED IN TASK 7. Keep the skill-separation intent: jab = safe/low,
// powerPunch = swingy/high, kicks add target variety, elbow = sharp short-range KO threat.
export const STRIKES: Record<StrikeId, StrikeProfile> = {
  jab:        { id: 'jab',        label: 'Jab',         blurb: 'Fast, safe, points.',          target: 'head', atkMult: 0.90, defMult: 1.15, power: 0.80, staminaCost: 6,  koWeight: 0.4, speed: 0.90 },
  powerPunch: { id: 'powerPunch', label: 'Power Punch', blurb: 'Swing for the KO — you commit.', target: 'head', atkMult: 1.35, defMult: 0.80, power: 1.25, staminaCost: 14, koWeight: 1.3, speed: 0.20 },
  bodyKick:   { id: 'bodyKick',   label: 'Body Kick',   blurb: 'Dig to the ribs, drain his gas.', target: 'body', atkMult: 1.15, defMult: 0.90, power: 1.10, staminaCost: 12, koWeight: 0.2, speed: 0.40 },
  legKick:    { id: 'legKick',    label: 'Leg Kick',    blurb: 'Chop the lead leg, kill his base.', target: 'legs', atkMult: 1.00, defMult: 1.00, power: 0.90, staminaCost: 9,  koWeight: 0.0, speed: 0.50 },
  knee:       { id: 'knee',       label: 'Knee',        blurb: 'Clinch weapon — heavy, tiring.', target: 'body', atkMult: 1.25, defMult: 0.85, power: 1.15, staminaCost: 13, koWeight: 0.6, speed: 0.30 },
  elbow:      { id: 'elbow',      label: 'Elbow',       blurb: 'Short, sharp, cuts — high risk.', target: 'head', atkMult: 1.20, defMult: 0.95, power: 1.15, staminaCost: 10, koWeight: 1.0, speed: 0.55 },
};

export const STRIKE_PALETTE: readonly StrikeId[] = ['jab', 'powerPunch', 'bodyKick', 'legKick', 'knee', 'elbow'] as const;

export function strikeProfile(id: StrikeId): StrikeProfile {
  return STRIKES[id];
}
```

- [ ] **Step 4: Add barrel export** — in `src/domain/combat/index.ts` add `export * from './strikes';`.

- [ ] **Step 5: Run test → PASS**; `npx tsc --noEmit` clean.

- [ ] **Step 6: Commit** — `feat(combat): strike palette profiles` (+ trailer).

---

### Task 2: `ExchangeMove` type + move helpers (`intents.ts`)

**Files:**
- Modify: `src/domain/combat/intents.ts`
- Test: `src/domain/combat/intents.test.ts` (extend existing)

**Interfaces:**
- Consumes: `StrikeId` (Task 1), `Phase` (existing: `'strike' | 'wrestle'`).
- Produces:
  - `type ExchangeMove = { kind: 'strike'; strike: StrikeId } | { kind: 'takedown' }`
  - `const MOVE_KIND_LABELS: Record<'strike' | 'takedown', string>`
  - `function movePhase(m: ExchangeMove): Phase` — `'strike'` → `'strike'`, `'takedown'` → `'wrestle'`
  - `function isTakedown(m: ExchangeMove): m is Extract<ExchangeMove, { kind: 'takedown' }>`

> Keep all existing `RoundIntent` / `StrikeTactic` / `intentPhase` exports — they remain referenced by not-yet-migrated tests and by `gameplan.ts`. Do not delete them in M15.

- [ ] **Step 1: Write the failing test** (append to `intents.test.ts`)

```ts
import { movePhase, isTakedown, MOVE_KIND_LABELS, type ExchangeMove } from './intents';

describe('ExchangeMove', () => {
  it('maps strike moves to the strike phase', () => {
    const m: ExchangeMove = { kind: 'strike', strike: 'jab' };
    expect(movePhase(m)).toBe('strike');
    expect(isTakedown(m)).toBe(false);
  });
  it('maps takedown moves to the wrestle phase', () => {
    const m: ExchangeMove = { kind: 'takedown' };
    expect(movePhase(m)).toBe('wrestle');
    expect(isTakedown(m)).toBe(true);
  });
  it('labels both move kinds', () => {
    expect(MOVE_KIND_LABELS.strike.length).toBeGreaterThan(0);
    expect(MOVE_KIND_LABELS.takedown.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run → FAIL** ("movePhase is not a function").

- [ ] **Step 3: Implement** — append to `intents.ts`:

```ts
import type { StrikeId } from './strikes';

export type ExchangeMove =
  | { kind: 'strike'; strike: StrikeId }
  | { kind: 'takedown' };

export const MOVE_KIND_LABELS: Record<'strike' | 'takedown', string> = {
  strike: 'Strike',
  takedown: 'Takedown',
};

export function movePhase(m: ExchangeMove): Phase {
  return m.kind === 'strike' ? 'strike' : 'wrestle';
}

export function isTakedown(m: ExchangeMove): m is Extract<ExchangeMove, { kind: 'takedown' }> {
  return m.kind === 'takedown';
}
```

> Note: `intents.ts` importing from `strikes.ts` is a one-way leaf dependency (strikes imports nothing from intents) — no cycle.

- [ ] **Step 4: Run → PASS**; `tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `feat(combat): ExchangeMove type + helpers` (+ trailer).

---

### Task 3: Opponent palette AI + move-log types (`fightState.ts`) — lands coupled with Task 4

> **Coupling note (read first):** T3 retypes `RoundLogEntry` to `ExchangeMove` and renames `opponentIntent`→`opponentMove`. `resolve.ts` (`resolveRound`) still consumes the old symbols and is **retired in Task 4**. Therefore T3's standalone commit may not typecheck in isolation — that is expected. Implement T3 then T4 as a **coupled pair and run the full green gate (vitest ×2 / tsc / build) at the END of Task 4.** Every commit still carries the trailer; the PR is squash-merged so intermediate non-compiling commits never reach `main` history individually (same pattern used successfully in M8b).

**Files:**
- Modify: `src/domain/combat/fightState.ts`
- Test: `src/domain/combat/fightState.test.ts` (extend; migrate references to the renamed symbol)

**Interfaces:**
- Consumes: `ExchangeMove`, `movePhase` (Task 2); `STRIKES`, `STRIKE_PALETTE`, `StrikeId` (Task 1); `createRng`, `PHASE_OFFENSE`, `isGassed`.
- Produces:
  - `RoundLogEntry` now `{ round: number; exchange: number; playerIntent: ExchangeMove; opponentIntent: ExchangeMove; winner: 'player'|'opponent'|'draw'; dominance: number }` (field names kept; **types change to `ExchangeMove`**, new `exchange` field).
  - `function opponentMove(state: FightState): ExchangeMove` (replaces `opponentIntent`).
  - `computePredictability(log, n)` unchanged signature; **redefined**: fraction of the last `n` beats where the player threw a head-hunting power strike (`kind==='strike'` and `STRIKES[strike].koWeight >= HEAD_HUNT_KOWEIGHT`).
  - `adaptiveCounterChance` unchanged.
  - `FightState.exchange: number`; `Fighter2.legDamage: number` — **added in Task 4**, but declare the `exchange` field on `FightState` here if convenient; keep factory changes in Task 4 to keep this task green in isolation. (Implementer: if adding the field here trips `tsc`, defer the type edits to Task 4 and only rename `opponentIntent`→`opponentMove` + redefine predictability here.)

**AI design:** pick the phase exactly as today (`wrestleEdge > strikeEdge` → `{kind:'takedown'}`). For strikes, choose a `StrikeId` from the palette biased by:
- gassed player → prefer a body/leg strike (`bodyKick`) to compound the gas;
- adaptive read (M12): if `roll < adaptiveCounterChance(fightIQ, predictability)` → throw the **fast counter** (`jab`) to punish head-hunting;
- else archetype/aggression bias: higher `fightNumber` → more `powerPunch`; else a spread across `jab`/`elbow`/`bodyKick`/`legKick`. Use the two upfront RNG draws (`roll`, `pick`) — **no extra draws** beyond today's two, to minimise determinism churn.

- [ ] **Step 1: Write the failing test** (append; also update any existing test that imports `opponentIntent` → `opponentMove`, and that reads `log[i].playerIntent.tactic` → the new move shape)

```ts
import { opponentMove, computePredictability, type FightState } from './fightState';
import { STRIKES } from './strikes';
import type { ExchangeMove, RoundLogEntry } from './intents'; // ExchangeMove; RoundLogEntry stays in fightState — import from there

// helper: a minimal in-round state (reuse the existing test factory if present)
function stateWithLog(log: RoundLogEntry[], overrides: Partial<FightState> = {}): FightState {
  // build via startFight(...) then splice log/round — see existing test helpers
  // ...
}

describe('opponentMove', () => {
  it('is deterministic for a fixed seed / fight / round / exchange', () => {
    const s = /* startFight with seed 'ai-seed', fightNumber 3, exchange 1 */;
    expect(opponentMove(s)).toEqual(opponentMove(s));
  });

  it('returns a strike move from the palette or a takedown', () => {
    const s = /* ... */;
    const m = opponentMove(s);
    if (m.kind === 'strike') expect(STRIKES[m.strike]).toBeDefined();
    else expect(m.kind).toBe('takedown');
  });
});

describe('computePredictability (head-hunting)', () => {
  it('is 0 with fewer than n beats', () => {
    expect(computePredictability([], 3)).toBe(0);
  });
  it('is 1.0 when the last n beats are all head power strikes', () => {
    const beat = (): RoundLogEntry => ({
      round: 1, exchange: 1,
      playerIntent: { kind: 'strike', strike: 'powerPunch' },
      opponentIntent: { kind: 'strike', strike: 'jab' },
      winner: 'player', dominance: 5,
    });
    expect(computePredictability([beat(), beat(), beat()], 3)).toBe(1);
  });
  it('is 0 when the player mixes in non-KO strikes', () => {
    const jabBeat: RoundLogEntry = {
      round: 1, exchange: 1,
      playerIntent: { kind: 'strike', strike: 'jab' },
      opponentIntent: { kind: 'strike', strike: 'jab' },
      winner: 'draw', dominance: 0,
    };
    expect(computePredictability([jabBeat, jabBeat, jabBeat], 3)).toBe(0);
  });
});
```

- [ ] **Step 2: Run → FAIL** ("opponentMove is not a function" / predictability shape mismatch).

- [ ] **Step 3: Implement** in `fightState.ts`:
  - Add `import { STRIKES, STRIKE_PALETTE, type StrikeId } from './strikes';` and `import type { ExchangeMove } from './intents';`.
  - Change `RoundLogEntry`: add `exchange: number`; retype `playerIntent`/`opponentIntent` to `ExchangeMove`.
  - Add a `HEAD_HUNT_KOWEIGHT = 1.0` constant.
  - Redefine `computePredictability`:

```ts
export function computePredictability(log: RoundLogEntry[], n: number): number {
  if (log.length < n) return 0;
  const recent = log.slice(-n);
  const headHunts = recent.filter(
    (e) => e.playerIntent.kind === 'strike' && STRIKES[e.playerIntent.strike].koWeight >= HEAD_HUNT_KOWEIGHT,
  ).length;
  return headHunts / recent.length;
}
```

  - Rename `opponentIntent`→`opponentMove` returning `ExchangeMove` (keep the seed key `` `${state.seed}#f${state.fightNumber}#ai${state.round}#x${state.exchange}` `` — **add `#x${exchange}`**), the two upfront draws, the `wrestleEdge > strikeEdge → { kind: 'takedown' }` branch, then strike selection:

```ts
export function opponentMove(state: FightState): ExchangeMove {
  const rng = createRng(`${state.seed}#f${state.fightNumber}#ai${state.round}#x${state.exchange}`);
  const roll = rng();
  const pick = rng();

  const strikeEdge = state.opponent.statLine[PHASE_OFFENSE.strike] - state.player.statLine.strikingDef;
  const wrestleEdge = state.opponent.statLine[PHASE_OFFENSE.wrestle] - state.player.statLine.takedownDef;
  if (wrestleEdge > strikeEdge) return { kind: 'takedown' };

  // Gassed player: dig the body/legs to compound the gas.
  if (isGassed(state.player.stamina)) return { kind: 'strike', strike: 'bodyKick' };

  // Adaptive read (M12): punish predictable head-hunting with a fast counter jab.
  const predictability = computePredictability(state.log, ADAPTIVE_N);
  const counterChance = adaptiveCounterChance(state.opponent.statLine.fightIQ, predictability);
  if (roll < counterChance) return { kind: 'strike', strike: 'jab' };

  // Aggression bias by fightNumber: later fights swing more power.
  const aggression = Math.min(1, (state.fightNumber - 1) / 4);
  if (roll < aggression * 0.5) return { kind: 'strike', strike: 'powerPunch' };

  const MIX: readonly StrikeId[] = ['jab', 'elbow', 'bodyKick', 'legKick'];
  return { kind: 'strike', strike: MIX[Math.floor(pick * MIX.length)] };
}
```

  - **Do NOT** yet add `exchange`/`legDamage` to the state factories if it breaks isolation; but you MUST give `opponentMove` a defined `state.exchange` to read. Simplest: add `exchange` to `FightState` + `startFight` here (default 1) and `legDamage` in Task 4. If you add `exchange` here, also add `exchange: 1` to `startFight` and `chooseGamePlan` (reset to 1) so this task's `tsc` stays green.

- [ ] **Step 4: Run → PASS**; `tsc --noEmit` clean.
- [ ] **Step 5: Commit** — `feat(combat): opponent palette AI + head-hunt predictability` (+ trailer).

---

### Task 4: Exchange engine (`exchange.ts`) — THE HEART

**Files:**
- Create: `src/domain/combat/exchange.ts`
- Test: `src/domain/combat/exchange.test.ts`
- Modify: `src/domain/combat/fightState.ts` (`Fighter2.legDamage`, factory `legDamage:0`; ensure `exchange:1` in factory + `chooseGamePlan` reset), `src/domain/combat/report.ts` (input retype + timing headline — see Coupled retypes), `src/domain/combat/finish.ts` (ResolvedContext retype + read-path + synthetic literals + corner `exchange:1` — see Coupled retypes), `src/domain/combat/index.ts` (`export * from './exchange';`), `src/domain/combat/resolve.ts` (retire `resolveRound`; re-export shared math), and **migrate** `src/domain/combat/resolve.test.ts` → `exchange.test.ts` semantics.

**Interfaces:**
- Consumes: `ExchangeMove`, `movePhase`, `isTakedown` (T2); `STRIKES`, `strikeProfile` (T1); `opponentMove` (T3); `gamePlanEffect`; `detectWindow`, `INITIAL_STEPS`, `chooseGroundPlan`, `groundAndPoundDamage`, `ROCKED_HEAD_DMG` (finish.ts); `scoreFight`; `staminaCost`? — **NO**: stamina cost now comes from the strike profile (`profile.staminaCost`) / a takedown constant; keep `recovery`, `bodyRecoveryPenalty`, `effortMultiplier`, `mobilityMultiplier`, `clampStamina`.
- Produces:
  - `const EXCHANGES_PER_ROUND = 3`
  - `function resolveExchange(state: FightState, move: ExchangeMove): FightState`

**Per-beat stamina cost:** strike → `STRIKES[move.strike].staminaCost`; takedown → reuse the old `WRESTLE_COST` (17) via a local `TAKEDOWN_COST` constant (keep the value; a shoot is a whole-body commitment). Recovery is NOT applied per beat — only at the round boundary.

**Coupled retypes (MUST land in this task so the tree compiles).** The log/report/finish types all reference the old `RoundIntent`+`.tactic`; switching the live round to `ExchangeMove` forces these together:

- **`report.ts` input retype** — change `RoundReportInput.playerIntent`/`opponentIntent` from `RoundIntent` to `ExchangeMove`, and rewrite the two `.tactic === 'counter'/'pressure'` headline branches to the timing vocabulary (a **fast** strike `STRIKES[x].speed >= 0.7` beating a **high-commit** one `STRIKES[y].koWeight >= 1.0`):
  ```ts
  } else if (
    winner === 'player'
    && playerIntent.kind === 'strike' && STRIKES[playerIntent.strike].speed >= 0.7
    && opponentIntent.kind === 'strike' && STRIKES[opponentIntent.strike].koWeight >= 1.0
  ) { headline = 'Perfect timing — you read him cold.'; }
  else if (
    winner === 'opponent'
    && opponentIntent.kind === 'strike' && STRIKES[opponentIntent.strike].speed >= 0.7
    && playerIntent.kind === 'strike' && STRIKES[playerIntent.strike].koWeight >= 1.0
  ) { headline = 'He timed you cold.'; }
  ```
  (`RoundReport` OUTPUT shape is unchanged — `RoundRecap`/`MomentumBar`/persistence stay stable.)
- **`finish.ts` `ResolvedContext` retype + read-path rewrite** — change `ResolvedContext.playerIntent`/`opponentIntent` to `ExchangeMove`; import `STRIKES`; replace the counter-vs-pressure read-path (finish.ts ~lines 127–137) with the same fast-beats-commit test:
  ```ts
  const fastBeatsCommit = (fast: ExchangeMove, slow: ExchangeMove) =>
    fast.kind === 'strike' && slow.kind === 'strike' &&
    STRIKES[fast.strike].speed >= 0.7 && STRIKES[slow.strike].koWeight >= 1.0;
  if (fastBeatsCommit(playerIntent, opponentIntent) && dominance > 0) return { side: 'player', method: 'KO', stepsLeft: INITIAL_STEPS };
  if (fastBeatsCommit(opponentIntent, playerIntent) && dominance < 0) return { side: 'opponent', method: 'KO', stepsLeft: INITIAL_STEPS };
  ```
- **`finish.ts` synthetic intent literals** — `groundStep`/`finishStep` build log/report inputs with `{ kind: 'strike', target: 'head', tactic: 'pressure' }` (finish.ts ~lines 279–280, 304–305, 346–347). Replace each with an `ExchangeMove` literal: `{ kind: 'strike', strike: 'powerPunch' }` (a head power strike — the closest analog for ground-and-pound context).
- **`finish.ts` `exchange: 1` on the corner transition only** — the single `return` that sets `phase: 'corner'` (finish.ts ~line 225) must also set `exchange: 1`. The `phase: 'finished'` returns do NOT need it (terminal; exchange stays frozen per the invariant).

- [ ] **Step 1: Write the failing tests** (the contract). Use `startFight(...)` with a fixed seed and a stub opponent stat line; drive real beats.

```ts
// src/domain/combat/exchange.test.ts
import { describe, it, expect } from 'vitest';
import { startFight, chooseGamePlan, type FightState } from './fightState';
import { resolveExchange, EXCHANGES_PER_ROUND } from './exchange';
import type { ExchangeMove } from './intents';
import type { StatLine } from './stats';

const P: StatLine = { striking: 80, strikingDef: 70, takedowns: 40, takedownDef: 80, submissions: 40, submissionDef: 70, cardio: 75, chin: 70, fightIQ: 80 };
const O: StatLine = { striking: 55, strikingDef: 55, takedowns: 45, takedownDef: 55, submissions: 45, submissionDef: 55, cardio: 60, chin: 60, fightIQ: 55 };
const jab: ExchangeMove = { kind: 'strike', strike: 'jab' };

function fresh(seed = 'x-seed', fightNumber = 1): FightState {
  return startFight({ seed, fightNumber, playerStatLine: P, opponent: { id: 'o', name: 'Foe', archetype: 'striker', statLine: O } });
}

describe('resolveExchange', () => {
  it('starts at exchange 1', () => {
    expect(fresh().exchange).toBe(1);
    expect(fresh().phase).toBe('in-round');
  });

  it('advances the exchange counter without advancing the round on a non-terminal beat', () => {
    const s1 = resolveExchange(fresh(), jab);
    expect(s1.phase).toBe('in-round');
    expect(s1.exchange).toBe(2);
    expect(s1.round).toBe(1);
    expect(s1.lastReport).not.toBeNull();
  });

  it(`goes to the corner only after ${EXCHANGES_PER_ROUND} exchanges, resetting exchange to 1`, () => {
    let s = fresh();
    for (let i = 0; i < EXCHANGES_PER_ROUND; i++) s = s.phase === 'in-round' ? resolveExchange(s, jab) : s;
    // if no finish fired, the last beat advances the round
    if (s.phase === 'corner') {
      expect(s.round).toBe(2);
      expect(s.exchange).toBe(1);
      expect(s.gamePlan).toBeNull();
    }
  });

  it('is deterministic (same seed + same moves ⇒ identical state)', () => {
    const a = resolveExchange(resolveExchange(fresh(), jab), jab);
    const b = resolveExchange(resolveExchange(fresh(), jab), jab);
    expect(a).toEqual(b);
  });

  it('charges per-beat stamina cost but withholds recovery until the round boundary', () => {
    const s0 = fresh();
    const s1 = resolveExchange(s0, jab); // non-terminal beat 1
    // jab costs 6, no recovery yet → player stamina strictly below start
    expect(s1.player.stamina).toBeLessThan(s0.player.stamina);
  });

  it('rejects a call when not in-round', () => {
    const cornerish = { ...fresh(), phase: 'corner' as const };
    expect(() => resolveExchange(cornerish, jab)).toThrow(/in-round/);
  });

  it('a winning takedown opens the player ground-window (interim), freezing the round', () => {
    // choose a player with a big wrestle edge and a takedown move
    const wrestler: StatLine = { ...P, takedowns: 95, striking: 40 };
    const s = startFight({ seed: 'td-seed', fightNumber: 1, playerStatLine: wrestler, opponent: { id: 'o', name: 'Foe', archetype: 'striker', statLine: O } });
    const td: ExchangeMove = { kind: 'takedown' };
    const r = resolveExchange(s, td);
    // Either the ground window opened (dominance>0) — assert the interim contract when it does:
    if (r.phase === 'ground-window') {
      expect(r.window).toEqual({ side: 'player', method: 'ground', stepsLeft: expect.any(Number) });
      expect(r.round).toBe(1); // frozen
    }
  });

  it('leg damage accrues on a winning leg kick and lowers the loser mobility story', () => {
    // drive a beat the player clearly wins with a leg kick; opponent legDamage should be >= 0 and,
    // when the player wins to the legs, strictly increase.
    const legKick: ExchangeMove = { kind: 'strike', strike: 'legKick' };
    const s = resolveExchange(fresh('leg-seed', 1), legKick);
    expect(s.opponent.legDamage).toBeGreaterThanOrEqual(0);
    expect(s.player.legDamage).toBe(0);
  });
});
```

> The implementer must pick seeds that make the directional assertions true (win/lose a specific beat). Use a throwaway probe (`console.log` the dominance) to select seeds, then delete the probe. This mirrors how the M4/M14 vector tests were pinned.

- [ ] **Step 2: Run → FAIL** ("Cannot find module './exchange'").

- [ ] **Step 3: Implement `exchange.ts`.** Port the two-sided dominance math from `resolve.ts` verbatim, swapping the per-side multipliers/target to the strike profile. Skeleton (fill the ground/finish branches by porting the existing `resolve.ts` branches, adjusted for the exchange contract):

```ts
// src/domain/combat/exchange.ts
import type { FightState, RoundLogEntry, Fighter2 } from './fightState';
import { opponentMove } from './fightState';
import { scoreFight } from './judges';
import type { ExchangeMove } from './intents';
import { movePhase } from './intents';
import { STRIKES } from './strikes';
import { PHASE_OFFENSE, PHASE_DEFENSE } from './stats';
import { recovery, effortMultiplier, mobilityMultiplier, STAMINA_MAX, isGassed } from './stamina';
import { createRng } from '../rng';
import { detectWindow, INITIAL_STEPS, chooseGroundPlan, groundAndPoundDamage, ROCKED_HEAD_DMG } from './finish';
import { gamePlanEffect } from './gameplan';
import { buildRoundReport, type RoundReport } from './report';

export const EXCHANGES_PER_ROUND = 3;

// Tuning — ported from resolve.ts (Task 7 may retune).
const IQ_FACTOR = 0.1;
const SWING_RANGE = 24;
const DMG_FACTOR = 0.55;
const COUNTER_BONUS = 10;
const BODY_TO_STAMINA = 0.5;
const BODY_RECOVERY_FACTOR = 0.08;
const TAKEDOWN_COST = 17;
const TAKEDOWN_ATK = 1.1;
const TAKEDOWN_VS_STRIKE_DEF = 0.9;

function clampStamina(s: number): number { return Math.max(0, Math.min(STAMINA_MAX, s)); }
function bodyRecoveryPenalty(bodyDamage: number): number { return Math.round(bodyDamage * BODY_RECOVERY_FACTOR); }

/** Offensive multiplier for a move. */
function atkMult(move: ExchangeMove): number {
  return move.kind === 'strike' ? STRIKES[move.strike].atkMult : TAKEDOWN_ATK;
}
/** Defensive exposure of the DEFENDER's chosen move against an incoming phase. */
function defMult(defender: ExchangeMove, incomingPhase: 'strike' | 'wrestle'): number {
  if (incomingPhase === 'wrestle') return 1.0;
  return defender.kind === 'strike' ? STRIKES[defender.strike].defMult : TAKEDOWN_VS_STRIKE_DEF;
}
/** Timing read: a fast defender strike punishes a slow, high-commit attacker strike. */
function timingBonus(defender: ExchangeMove, attacker: ExchangeMove): number {
  if (defender.kind !== 'strike' || attacker.kind !== 'strike') return 0;
  const gap = STRIKES[defender.strike].speed - STRIKES[attacker.strike].speed;
  return gap > 0 ? Math.round(COUNTER_BONUS * gap) : 0;
}

export function resolveExchange(state: FightState, playerMove: ExchangeMove): FightState {
  if (state.phase !== 'in-round') {
    throw new Error(`resolveExchange requires state.phase === "in-round" (got "${state.phase}")`);
  }
  const oppMove = opponentMove(state);
  const plan = gamePlanEffect(state.gamePlan);
  const rng = createRng(`${state.seed}#f${state.fightNumber}#r${state.round}#x${state.exchange}`);
  const seededSwing = (rng() - 0.5) * SWING_RANGE;

  const pEffort = effortMultiplier(state.player.stamina) * mobilityMultiplier(state.player.legDamage);
  const oEffort = effortMultiplier(state.opponent.stamina) * mobilityMultiplier(state.opponent.legDamage);

  const pPhase = movePhase(playerMove);
  const oPhase = movePhase(oppMove);

  const playerAttackScore =
    state.player.statLine[PHASE_OFFENSE[pPhase]] * pEffort * atkMult(playerMove) * plan.atkMult -
    state.opponent.statLine[PHASE_DEFENSE[pPhase]] * oEffort * defMult(oppMove, pPhase) +
    timingBonus(playerMove, oppMove);

  const oppAttackScore =
    state.opponent.statLine[PHASE_OFFENSE[oPhase]] * oEffort * atkMult(oppMove) -
    state.player.statLine[PHASE_DEFENSE[oPhase]] * pEffort * defMult(playerMove, oPhase) * plan.defMult +
    timingBonus(oppMove, playerMove);

  const dominance =
    playerAttackScore - oppAttackScore +
    (state.player.statLine.fightIQ - state.opponent.statLine.fightIQ) * IQ_FACTOR +
    seededSwing;

  // ── interim takedown branches (port resolve.ts ground-window + opponent-ground here) ──
  //   player wins + takedown → ground-window (round frozen)
  //   opp wins + takedown    → chooseGroundPlan → submission finish-window / GnP rock finish-window / GnP advance
  //   These paths advance the ROUND (not the exchange); on any round advance set exchange:1 and
  //   apply the round-boundary recovery+plan.staminaDelta to both fighters (see roundBoundaryStamina()).
  //   (Copy the exact branch bodies from resolve.ts lines ~138–323, replacing staminaCost(intent) with
  //    the move cost, adding legDamage passthrough (0 change on these paths), and threading exchange:1.)

  // ── strike exchange ──
  const winnerMove = dominance > 0 ? playerMove : oppMove;
  const power = winnerMove.kind === 'strike' ? STRIKES[winnerMove.strike].power : 1;
  const target = winnerMove.kind === 'strike' ? STRIKES[winnerMove.strike].target : 'head';
  const dmg = Math.round(Math.abs(dominance) * DMG_FACTOR * power);

  const p: Fighter2 = { ...state.player };
  const o: Fighter2 & { name: string; archetype: string } = { ...state.opponent };

  if (dominance > 0) {
    if (target === 'body') { o.bodyDamage += dmg; o.stamina -= Math.round(dmg * BODY_TO_STAMINA); }
    else if (target === 'legs') { o.legDamage += dmg; }
    else { o.headDamage += dmg; }
  } else if (dominance < 0) {
    if (target === 'body') { p.bodyDamage += dmg; p.stamina -= Math.round(dmg * BODY_TO_STAMINA); }
    else if (target === 'legs') { p.legDamage += dmg; }
    else { p.headDamage += dmg; }
  }

  // per-beat stamina COST only (no recovery mid-round)
  const pCost = playerMove.kind === 'strike' ? STRIKES[playerMove.strike].staminaCost : TAKEDOWN_COST;
  const oCost = oppMove.kind === 'strike' ? STRIKES[oppMove.strike].staminaCost : TAKEDOWN_COST;
  p.stamina = clampStamina(p.stamina - pCost);
  o.stamina = clampStamina(o.stamina - oCost);

  const margin = Math.floor(Math.abs(dominance) / 10);
  if (dominance > 0) p.roundScore += 1 + margin;
  else if (dominance < 0) o.roundScore += 1 + margin;

  const winner: 'player' | 'opponent' | 'draw' = dominance > 0 ? 'player' : dominance < 0 ? 'opponent' : 'draw';
  const logEntry: RoundLogEntry = { round: state.round, exchange: state.exchange, playerIntent: playerMove, opponentIntent: oppMove, winner, dominance };

  const report: RoundReport = buildRoundReport({
    round: state.round, winner, dominance,
    playerIntent: playerMove, opponentIntent: oppMove,
    playerHeadDelta: Math.max(0, p.headDamage - state.player.headDamage),
    playerBodyDelta: Math.max(0, p.bodyDamage - state.player.bodyDamage),
    opponentHeadDelta: Math.max(0, o.headDamage - state.opponent.headDamage),
    opponentBodyDelta: Math.max(0, o.bodyDamage - state.opponent.bodyDamage),
    playerBecameRocked: state.player.headDamage < ROCKED_HEAD_DMG(state.player.statLine.chin) && p.headDamage >= ROCKED_HEAD_DMG(state.player.statLine.chin),
    opponentBecameRocked: state.opponent.headDamage < ROCKED_HEAD_DMG(state.opponent.statLine.chin) && o.headDamage >= ROCKED_HEAD_DMG(state.opponent.statLine.chin),
    playerGassed: isGassed(p.stamina), opponentGassed: isGassed(o.stamina),
  });

  // finish detection (mid-round window freezes the round + exchange)
  const finishWindow = detectWindow({
    prePlayerHeadDamage: state.player.headDamage, preOpponentHeadDamage: state.opponent.headDamage,
    playerHeadDamage: p.headDamage, opponentHeadDamage: o.headDamage,
    playerStamina: p.stamina, opponentStamina: o.stamina,
    playerStatLine: state.player.statLine, opponentStatLine: state.opponent.statLine,
    dominance, playerIntent: playerMove, opponentIntent: oppMove,
  });
  const base = { ...state, player: p, opponent: o, log: [...state.log, logEntry], lastReport: report };
  if (finishWindow) {
    return { ...base, phase: 'finish-window', window: finishWindow, gamePlan: null };
  }

  // not the last beat → next exchange, same round
  if (state.exchange < EXCHANGES_PER_ROUND) {
    return { ...base, exchange: state.exchange + 1 };
  }

  // last beat → round boundary: apply recovery + plan stamina delta to BOTH fighters
  const pRb = clampStamina(p.stamina + recovery(state.player.statLine) - bodyRecoveryPenalty(p.bodyDamage) + plan.staminaDelta);
  const oRb = clampStamina(o.stamina + recovery(state.opponent.statLine) - bodyRecoveryPenalty(o.bodyDamage));
  const p2 = { ...p, stamina: pRb };
  const o2 = { ...o, stamina: oRb };
  const isLast = state.round >= state.rounds;
  if (isLast) {
    const finalBase: FightState = { ...base, player: p2, opponent: o2, exchange: 1, phase: 'finished', gamePlan: null };
    return { ...finalBase, outcome: scoreFight(finalBase) };
  }
  return { ...base, player: p2, opponent: o2, exchange: 1, round: state.round + 1, phase: 'corner', gamePlan: null, outcome: null };
}
```

  - Add `Fighter2.legDamage: number` in `fightState.ts` (+ `legDamage: 0` in `makeFighter`). Confirm `startFight` sets `exchange: 1` and `chooseGamePlan` returns `exchange: 1`.
  - In `finish.ts`: apply the **Coupled retypes** section above (ResolvedContext → `ExchangeMove`, read-path rewrite, synthetic literal replacement, `exchange: 1` on the corner transition).
  - In `resolve.ts`: delete `resolveRound` (or keep the file for the shared constants but remove the export); update the barrel so `resolveRound` is no longer exported. **Migrate `resolve.test.ts`**: the golden-master/round-1 tests move to `exchange.test.ts` as first-beat assertions (a single `resolveExchange` from a fresh state, gamePlan null). Delete now-dead `resolve.test.ts` cases that assumed whole-round resolution.
  - Barrel: `export * from './exchange';`.

- [ ] **Step 4: Run → PASS**; run the FULL suite `npx vitest run` (migrations may ripple — fix referencing tests to the exchange model); `tsc --noEmit` clean; `npm run build` clean.
- [ ] **Step 5: Commit** — `feat(combat): multi-exchange round engine (resolveExchange)` (+ trailer).

---

### Task 5: Leg damage → mobility (`stamina.ts`)

**Files:**
- Modify: `src/domain/combat/stamina.ts`
- Test: `src/domain/combat/stamina.test.ts` (extend)

**Interfaces:**
- Produces: `function mobilityMultiplier(legDamage: number): number` — `1.0` at 0 leg damage, decreasing to a floor (`~0.7`) as leg damage rises. Used by `exchange.ts` (Task 4) to scale effort.

- [ ] **Step 1: Failing test**

```ts
import { mobilityMultiplier } from './stamina';
describe('mobilityMultiplier', () => {
  it('is 1.0 with no leg damage', () => { expect(mobilityMultiplier(0)).toBe(1); });
  it('decreases as leg damage rises', () => { expect(mobilityMultiplier(40)).toBeLessThan(mobilityMultiplier(10)); });
  it('never drops below the 0.7 floor', () => { expect(mobilityMultiplier(1000)).toBeGreaterThanOrEqual(0.7); });
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement**

```ts
const MOBILITY_FLOOR = 0.7;
const MOBILITY_PER_DMG = 0.006; // ~0.30 lost by ~50 leg damage
export function mobilityMultiplier(legDamage: number): number {
  return Math.max(MOBILITY_FLOOR, 1 - Math.max(0, legDamage) * MOBILITY_PER_DMG);
}
```

- [ ] **Step 4: Run → PASS.** (Task 4 already imports it.)
- [ ] **Step 5: Commit** — `feat(combat): leg damage mobility multiplier` (+ trailer).

> If Task 4 was implemented before Task 5, add `mobilityMultiplier` first so `exchange.ts` compiles; task order here is logical, not strict — keep the suite green at each commit.

---

### Task 6: Leg-target report detail (additive polish)

**Files:**
- Modify: `src/domain/combat/report.ts` (detail line only — the input retype + timing headline already landed in Task 4)
- Test: `src/domain/combat/report.test.ts` (extend)

**Interfaces:**
- Consumes: `ExchangeMove` (already the input type after Task 4), `STRIKES` (T1).
- Produces: no signature change. Adds one detail-line branch: when the round WINNER's move targeted `'legs'`, `detail = "You're chopping his base down."` (player win) / `"He's chopping your base down."` (opponent win). All other detail/headline logic unchanged.

- [ ] **Step 1: Failing test** — a leg-target detail line:

```ts
import { buildRoundReport } from './report';
it('calls out leg chopping in the detail when the winner kicked the legs', () => {
  const r = buildRoundReport({
    round: 1, winner: 'player', dominance: 9,
    playerIntent: { kind: 'strike', strike: 'legKick' },
    opponentIntent: { kind: 'strike', strike: 'jab' },
    playerHeadDelta: 0, playerBodyDelta: 0, opponentHeadDelta: 0, opponentBodyDelta: 0,
    playerBecameRocked: false, opponentBecameRocked: false, playerGassed: false, opponentGassed: false,
  });
  expect(r.detail.toLowerCase()).toContain('base');
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — add the leg-target branch to the detail ladder (check the winner's move target === `'legs'` via `STRIKES`), ABOVE the generic "picked him apart" fallback. Keep every other line.
- [ ] **Step 4: Run → PASS**; `tsc` clean.
- [ ] **Step 5: Commit** — `feat(combat): leg-target round-report detail` (+ trailer).

> The **timing headline** (`'Perfect timing — you read him cold.'`) and the `ExchangeMove` input retype were verified as part of Task 4's Coupled retypes — Task 4's suite already asserts they compile and fire. Task 6 only adds the leg detail line.

---

### Task 7: Balance harness rewrite + re-derive BANDs — **GATE**

**Files:**
- Modify: `src/domain/combat/balance.test.ts`
- (Retune allowed: `src/domain/combat/strikes.ts` numbers, `EXCHANGES_PER_ROUND`, and the `exchange.ts` tuning constants — NEVER weaken a band.)

**Interfaces:**
- Consumes: `resolveExchange`, `EXCHANGES_PER_ROUND`, `chooseGamePlan`, `finishStep`, `groundStep`, `startFight`, `scoreFight`, `STRIKE_PALETTE`.

**`playFight(fightNumber, policy)` rewrite:** loop until `phase === 'finished'`:
- `'in-round'` → pick a move by policy and `resolveExchange`.
- `'corner'` → `chooseGamePlan(state, policy==='good' ? 'stay-disciplined' : 'push-pace')`.
- `'finish-window'` → `finishStep(state, policy==='good' ? 'commit' : 'commit')` (commit to hunt finishes; the good policy may `measure` when it's DEFENDING an opponent window — branch on `window.side`).
- `'ground-window'` → `groundStep(state, 'ground-and-pound')`.

Policies:
- **good** = varied, disciplined: mix `jab`/`bodyKick`/`legKick`/`elbow`, throw `powerPunch` only when the opponent is hurt/gassed; disciplined corner; measured defense.
- **careless** = the exploit probe: spam `powerPunch` every beat + `push-pace` every corner (head-hunt, no defense). This is what the adaptive AI must punish.

Reference player = `getFighter('georges-st-pierre')` (unchanged). 300 seeds per fight, fights 1–10.

**Re-derive the bands empirically, then assert (do NOT copy M14 numbers blindly — the exchange model shifts them):**
- **BAND 1 — finishes happen:** aggregate `good` finish rate across fights ≥ **0.30**.
- **BAND 2 — early carelessness is punished + skill matters:** `careless` fight-1 win rate ≤ **0.72** AND (`good`−`careless`) fight-1 gap ≥ **0.20**.
- **BAND 3 — no late wall for skill:** `good` win rate at fights 9 and 10 ≥ **0.45**.
- **BAND 4 — skill dominates at every fight:** `good` win rate > `careless` win rate for fights 1–10.
- **BAND 5 — the head-hunt exploit is dead:** `careless` win rate at fights 9 and 10 ≤ **0.42** (the adaptive AI + timing reads punish `powerPunch` spam).
- **BAND 6 — difficulty ramps (monotone-ish):** per policy, `winRate[n+1] ≤ winRate[n] + 0.12` for `n=1..9` except a single documented matchup dip (state it explicitly with the measured delta, as M12 did) — do not blanket-loosen.

Procedure: implement `playFight`, measure the raw curve first (print the table in the PR report), set each band's constant to the derived value, then retune `strikes.ts`/`EXCHANGES_PER_ROUND` until all six pass. If a target is provably unreachable, apply the **Achievable-floor rule**: set the band to the best stable measured value + a small buffer and NOTE it in the PR as a watch-item (never silently drop a band).

- [ ] **Step 1** Rewrite `playFight` to drive exchanges; run it to MEASURE the 10-fight good/careless win+finish table (temporary `console.log`).
- [ ] **Step 2** Write the six BAND assertions with the derived constants.
- [ ] **Step 3** Run → likely some RED; retune ONLY the new knobs; re-run until all six GREEN. Remove the temporary logging.
- [ ] **Step 4** Run the full suite twice — identical counts (determinism); `tsc`/`build` clean.
- [ ] **Step 5: Commit** — `test(balance): drive exchanges; re-derive bands` (+ trailer). Include the measured table in the commit body.

---

### Task 8: Persistence — schema v4 (`runStorageV2.ts`)

**Files:**
- Modify: `src/persistence/runStorageV2.ts`
- Test: `src/persistence/runStorageV2.test.ts` (extend)

**Interfaces:**
- Produces: `SCHEMA_VERSION = 4`; `isValidFighter2` also requires finite `legDamage`; `isValidFightState` also requires `Number.isInteger(exchange)` with `1 <= exchange <= EXCHANGES_PER_ROUND`.

- [ ] **Step 1: Failing tests** (RED-first): a valid mid-fight run with `exchange: 2` + `legDamage: 0` round-trips; a blob with `exchange: 0` (or `4`, or `2.5`) → `load().run === null`; a fighter missing `legDamage` → rejected; a persisted v3 blob → cleared to defaults (version bump).

```ts
it('round-trips a mid-fight run at exchange 2', () => {
  // save a real startFight→resolveExchange state with exchange===2; load returns it deep-equal
});
it('rejects an out-of-range exchange', () => {
  // hand-craft a valid fight blob but set exchange to 0 → load().run === null (cleared)
});
it('rejects a fighter with no legDamage', () => { /* ... */ });
it('clears a stale v3 blob', () => { /* version:3 → defaults */ });
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** — bump `SCHEMA_VERSION` to `4`; in `isValidFighter2` add `Number.isFinite(x['legDamage'])`; in `isValidFightState` add, near the `round` check:

```ts
import { EXCHANGES_PER_ROUND } from '../domain/combat';
// ...
if (!Number.isInteger(x['exchange']) || (x['exchange'] as number) < 1 || (x['exchange'] as number) > EXCHANGES_PER_ROUND) return false;
```

  (Do NOT add `exchange`/`legDamage` to `normalizeLegacyFightState` — the version bump clears older blobs, so no back-fill is needed; new runs always write the fields.)

- [ ] **Step 4: Run → PASS**; full suite green ×2; `tsc`/`build` clean.
- [ ] **Step 5: Commit** — `feat(persistence): schema v4 — exchange + legDamage` (+ trailer).

---

### Task 9: Strike palette picker UI (`StrikePanel.tsx`)

**Files:**
- Create: `src/components/StrikePanel.tsx`
- Test: `src/components/StrikePanel.test.tsx`

**Interfaces:**
- Consumes: `STRIKE_PALETTE`, `STRIKES`, `type ExchangeMove`, `type StatLine`, `PHASE_OFFENSE`, `STAT_LABELS`, `MOVE_KIND_LABELS`.
- Produces: `export default function StrikePanel({ statLine, exchange, exchangesPerRound, onMove, disabled? }: Props)` where `onMove: (m: ExchangeMove) => void`. One tap on a strike → `onMove({kind:'strike',strike})`; one tap on Takedown → `onMove({kind:'takedown'})`. Renders `data-testid="strike-panel"`, a `data-testid={`strike-${id}`}` button per palette entry (label + blurb + target), a `data-testid="strike-takedown"` button, and an "Exchange X of Y" caption.

- [ ] **Step 1: Failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import StrikePanel from './StrikePanel';
const P = { striking: 80, strikingDef: 70, takedowns: 40, takedownDef: 80, submissions: 40, submissionDef: 70, cardio: 75, chin: 70, fightIQ: 80 };

it('renders all six strikes + takedown and shows the exchange count', () => {
  render(<StrikePanel statLine={P as any} exchange={2} exchangesPerRound={3} onMove={() => {}} />);
  expect(screen.getByTestId('strike-jab')).toBeInTheDocument();
  expect(screen.getByTestId('strike-powerPunch')).toBeInTheDocument();
  expect(screen.getByTestId('strike-elbow')).toBeInTheDocument();
  expect(screen.getByTestId('strike-takedown')).toBeInTheDocument();
  expect(screen.getByText(/exchange 2 of 3/i)).toBeInTheDocument();
});

it('emits the strike move on tap', () => {
  const onMove = vi.fn();
  render(<StrikePanel statLine={P as any} exchange={1} exchangesPerRound={3} onMove={onMove} />);
  fireEvent.click(screen.getByTestId('strike-powerPunch'));
  expect(onMove).toHaveBeenCalledWith({ kind: 'strike', strike: 'powerPunch' });
});

it('emits the takedown move on tap', () => {
  const onMove = vi.fn();
  render(<StrikePanel statLine={P as any} exchange={1} exchangesPerRound={3} onMove={onMove} />);
  fireEvent.click(screen.getByTestId('strike-takedown'));
  expect(onMove).toHaveBeenCalledWith({ kind: 'takedown' });
});
```

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** `StrikePanel.tsx` — a responsive grid of palette buttons (label, blurb, target chip), a Takedown button, and the caption. Reuse Octagon Elite Tailwind classes seen in `IntentPanelV2` (`bg-surface-container`, `border-outline`, `font-mono text-xs uppercase tracking-widest`, primary CTA styling). Buttons honor `disabled`.
- [ ] **Step 4: Run → PASS**; `tsc`/`build` clean.
- [ ] **Step 5: Commit** — `feat(fight-ui): strike palette picker` (+ trailer).

---

### Task 10: Per-beat feedback + wire FightView + App + FULL GATE + dev look

**Files:**
- Modify: `src/fightDisplay.ts` (+ `src/fightDisplay.test.ts`) — add `legPct(f: Fighter2): number` (0..1, `min(1, legDamage/ LEG_MAX)`, `LEG_MAX≈60`) and `exchangeLabel(state: FightState): string` (`"Exchange 2 of 3"`).
- Modify: `src/screens/FightView.tsx` (+ `src/screens/FightView.test.tsx`)
- Modify: `src/App.tsx` (+ `src/App.test.tsx`)

**Interfaces:**
- `FightView` prop `onIntent` → `onMove: (m: ExchangeMove) => void`; render `StrikePanel` (not `IntentPanelV2`) on `phase==='in-round'`, passing `exchange={fightState.exchange}` + `exchangesPerRound={EXCHANGES_PER_ROUND}`; add `data-exchange={fightState.exchange}` to the `<section>`; keep the corner/finish/ground/finished branches. Surface a compact per-beat cue: the existing `damageFlash` (from `lastReport`) already fires each beat — keep it; add a small `exchangeLabel(...)` line near the round label.
- `App`: rename `handleIntent`→`handleMove`, dispatch `resolveExchange(r.fight, move)` when `r.fight.phase==='in-round'`; import `resolveExchange`, `EXCHANGES_PER_ROUND`, `type ExchangeMove` from `./domain/combat`; drop the `resolveRound` import.

- [ ] **Step 1: Failing tests**
  - `fightDisplay.test.ts`: `legPct` monotonic + clamped; `exchangeLabel(startFight-derived state with exchange 2)` === `"Exchange 2 of 3"`.
  - `FightView.test.tsx`: on an `in-round` state, `getByTestId('strike-panel')` present, `IntentPanelV2` gone; clicking `strike-jab` calls `onMove({kind:'strike',strike:'jab'})`; `data-exchange` reflects state.
  - `App.test.tsx`: from a fresh fight, three strike taps drive `exchange` 1→2→3→(corner or window); a full round reaches `corner`; the resume/e2e test asserts `data-round`/`data-exchange` survive a `save`→`load` round-trip. Migrate any `onIntent`/`resolveRound` references.

- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** the three wiring changes + the two display helpers.
- [ ] **Step 4: FULL GATE (fresh run, paste output in the PR):**

```bash
npx vitest run            # twice — identical counts
npx tsc --noEmit          # clean
npm run build             # clean
grep -rn 'Math.random(' src   # → 0
git diff --stat origin/main -- package.json package-lock.json   # → empty
```

- [ ] **Step 5: Manual dev look (the sensitive deliverable).** `npm run dev`; play a full fight: confirm each round takes **3 strike picks**, damage/meters move **per beat**, the strike palette reads clearly, leg kicks visibly sap the opponent (mobility/recap cue), the Corner still appears between rounds, finishes still fire when a beat rocks someone, and the finished recap + Continue still work. Note the feel in the PR body.
- [ ] **Step 6: Commit** — `feat(fight-ui): wire multi-exchange rounds + strike palette` (+ trailer). Open the PR `M15: multi-exchange rounds + strike palette` into `main`. Do NOT merge.

---

## Self-Review (run before opening the PR)

1. **Spec coverage** — multi-exchange rounds (T4), strike palette (T1/T2/T9), per-beat damage build (T4/T10), opponent palette AI (T3), leg target (T1/T4/T5/T6), interim wrestle→ground (T4), balance re-derivation (T7), persistence (T8), UI feel (T9/T10). ✅ Signatures/M17 threading are out of scope by design.
2. **Placeholder scan** — no "TODO/handle edge cases/similar to Task N"; every code step shows code. The two "port the branch from resolve.ts" notes in T4 reference an exact source range — the implementer copies real code, not a stub.
3. **Type consistency** — `ExchangeMove`, `StrikeId`, `resolveExchange`, `opponentMove`, `EXCHANGES_PER_ROUND`, `mobilityMultiplier`, `legDamage`, `exchange` are used with identical names/shapes across T1–T10. `RoundLogEntry` keeps field names `playerIntent`/`opponentIntent` (retyped to `ExchangeMove`) + adds `exchange` — persistence (T8) validates `log` only as an array, so no ripple. `RoundReport` output shape is unchanged → `RoundRecap`/`MomentumBar`/persistence stay stable.

## Execution Handoff

Subagent-Driven (recommended): fresh implementer + reviewer subagent per task, strict TDD, gate at Task 7 (balance) and Task 10 (full gate + dev look). **Task 3 + Task 4 land as a coupled pair** (see T3's coupling note) with the green gate at the end of T4. Safe parallelism elsewhere: T1 ∥ T5 (leaf data/helpers) first; then T2 (needs T1); then the T3+T4 engine pair (needs T1/T2/T5); then T6/T7/T8/T9 (need T4); T10 last (needs all).
