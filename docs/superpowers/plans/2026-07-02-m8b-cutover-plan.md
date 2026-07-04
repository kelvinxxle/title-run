# M8b: v2 UI Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the merged v2 combat engine (`src/domain/combat/`) into the UI so v2 is actually playable — new draft, the two-sided tactical fight with a hunt-the-finish pressure-decision sequence, judges fallback, no rewards, a fixed Hub, and exact mid-fight resume — then delete the dead v1 combat code.

**Architecture:** Strangler cutover. First build the genuinely-new leaf UI pieces additively (IntentPanel v2, FinishSequencePanel, FightView, v2 persistence) as new files while the live v1 app stays green. Then one integrating task rewrites `App.tsx` onto the v2 `RunState` machine, re-points the draft/Hub screens + `bestReign` to `src/domain/combat`, and makes the controller *own* the serializable `FightState` (in `run.fight`) so autosave gives exact resume. Finally delete v1 combat modules, the reward path, and dead components.

**Tech Stack:** React 18.3.1, TypeScript (strict), Vite, Tailwind, Vitest + React Testing Library. Client-only, `localStorage`. No new dependencies.

## Global Constraints

- **No new dependencies.** `package.json` deps stay `react` + `react-dom`; do not touch `package.json` or the lockfile.
- **No `Math.random` in `src/`.** All randomness flows through `createRng` (already inside the engine). The UI never rolls RNG directly.
- **TypeScript strict** — no `any`, no non-null `!` except where the engine's own contract guarantees it (mirror existing patterns). `tsc --noEmit` must stay clean.
- **Every commit** ends with exactly: `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>` (verify every commit — include "App").
- **Determinism preserved:** same seed + same intents ⇒ identical fight. The controller must never re-roll a fight on resume; it restores `run.fight` from storage.
- **Engine is the single source of combat truth.** The UI only calls the public API from `src/domain/combat` (barrel `./index.ts`). No combat math in components.
- **Gate at every task:** `npx vitest run`, `npx tsc --noEmit`, `npx vite build` all pass; push after each commit and verify `HEAD == @{u}`.
- **v1 stays green until the integrating task.** Tasks 1–4 are additive new files; do not modify `App.tsx`, existing screens, or v1 `src/domain/*` in those tasks.

## v2 Engine Public API (consumed by this plan — verbatim signatures)

From `src/domain/combat` (barrel):

```ts
// stats.ts
type StatId = 'striking'|'strikingDef'|'takedowns'|'takedownDef'|'submissions'|'submissionDef'|'cardio'|'chin'|'fightIQ';
const STAT_IDS: readonly StatId[];
const STAT_LABELS: Record<StatId,string>;
type StatLine = Record<StatId, number>;

// intents.ts
type Where = 'strike'|'wrestle'|'grapple';
type Target = 'head'|'body';
type Approach = 'pressure'|'technical'|'counter';
interface RoundIntent { where: Where; target: Target; approach: Approach; }
const WHERES: readonly Where[]; const TARGETS: readonly Target[]; const APPROACHES: readonly Approach[];
const INTENT_LABELS: { where: Record<Where,string>; target: Record<Target,string>; approach: Record<Approach,string> };

// draft.ts (structurally identical to v1 draft)
type DraftStatus = 'drafting'|'naming'|'complete';
interface DraftState { seed:string; rollCount:number; rolledFighterIds:string[]; current: RolledFighter|null; slots: Record<StatId, SlotFill|null>; status: DraftStatus; name: string|null; }
interface RolledFighter { fighterId: string; statLine: StatLine; }
interface SlotFill { value: number; sourceFighterId: string; }
interface DraftedFighter { name: string; statLine: StatLine; slots: Record<StatId, SlotFill>; }
function startDraft(seed: string): DraftState;
function keepStat(state: DraftState, statId: StatId): DraftState;
function nameFighter(state: DraftState, name: string): DraftState;
function getDraftedFighter(state: DraftState): DraftedFighter;
function availableStatIds(state: DraftState): StatId[];
function filledCount(state: DraftState): number;
function suggestedStatId(state: DraftState): StatId | null;

// roster.ts
interface Fighter { id:string; name:string; archetype:string; signature: Partial<StatLine>; }
function getFighter(id: string): Fighter;

// fightState.ts
type FightPhase = 'in-round'|'finish-window'|'finished';
interface FinishWindow { side:'player'|'opponent'; method:'KO'|'submission'; stepsLeft:number; }
interface FightOutcome { winner:'player'|'opponent'; method:'KO'|'submission'|'decision'; round:number; }
interface Fighter2 { statLine: StatLine; headDamage:number; bodyDamage:number; stamina:number; roundScore:number; }
interface FightState {
  seed:string; fightNumber:number; rounds:number; round:number; phase: FightPhase;
  player: Fighter2; opponent: Fighter2 & { name:string; archetype:string };
  window: FinishWindow|null; outcome: FightOutcome|null; log: RoundLogEntry[];
}
interface RoundLogEntry { round:number; playerIntent:RoundIntent; opponentIntent:RoundIntent; winner:'player'|'opponent'|'draw'; dominance:number; }
function roundsForFight(fightNumber: number): number; // 5 at fight>=5 else 3

// resolve.ts
function resolveRound(state: FightState, playerIntent: RoundIntent): FightState; // throws unless phase==='in-round'

// finish.ts
type FinishChoice = 'commit'|'measure'|'hold';
const FINISH_CHOICES: readonly FinishChoice[];
function finishStep(state: FightState, choice: FinishChoice): FightState; // throws unless phase==='finish-window'

// opponent.ts
interface Opponent { id:string; name:string; archetype:string; statLine:StatLine; }
function generateOpponent(seed: string, fightNumber: number): Opponent;

// stamina.ts
const STAMINA_MAX: number;        // 100
const GAS_THRESHOLD: number;      // 25
function isGassed(stamina: number): boolean;

// run.ts
type RunPhase = 'drafting'|'pre-fight'|'fighting'|'run-over';
interface RunFighter { name:string; statLine:StatLine; }
interface RunState { seed:string; phase:RunPhase; fighter:RunFighter|null; fightNumber:number; record:{wins:number;losses:number}; isChampion:boolean; defenses:number; fight: FightState|null; }
const TITLE_FIGHT: number;        // 5
function startRun(seed: string): RunState;                       // phase 'drafting'
function applyDraft(run: RunState, fighter: { name:string; statLine:StatLine }): RunState; // requires phase 'drafting' → 'pre-fight'
function startNextFight(run: RunState): RunState;                // requires phase 'pre-fight' → 'fighting', sets run.fight = startFight(...)
function settleFight(run: RunState, fightState: FightState): RunState; // requires phase 'fighting' + matching seed/fightNumber → win 'pre-fight', loss 'run-over'
```

**Note — the v2 engine has NO:** `carriedDamage`, `reward` phase, `applyReward`, `Reward`, `durability`, single-axis `Intent`, `opponent.style`. These v1 concepts are deleted in this milestone.

---

## File Map

**Create (Tasks 1–5, additive — v1 stays green):**
- `src/components/IntentPanelV2.tsx` (+ `.test.tsx`) — Task 1 — 3-axis `RoundIntent` selector.
- `src/components/FinishSequencePanel.tsx` (+ `.test.tsx`) — Task 2 — pressure-decision panel (commit/measure/hold).
- `src/fightDisplay.ts` (+ `.test.ts`) — Task 3 — pure display helpers (health %, stamina %, round label).
- `src/screens/FightView.tsx` (+ `.test.tsx`) — Task 4 — presentational fight view driven by a `FightState` prop + callbacks.
- `src/persistence/runStorageV2.ts` (+ `.test.ts`) — Task 5 — v2 schema/validation, key `title-run:v2`.

**Modify (Task 6, integrating cutover):**
- `src/App.tsx` — rewrite onto v2 `RunState` machine; own `run.fight`; explicit Continue → `settleFight`; remove reward path + FightScreen.
- `src/screens/DraftScreen.tsx` — re-point imports `../domain/draft`+`../domain/stats` → `../domain/combat`.
- `src/components/RolledFighterCard.tsx` — re-point stat/roster/draft imports to `../domain/combat`; `fighter.weightClass` → `fighter.archetype`.
- `src/components/SlotStatusChips.tsx` — re-point stat/draft imports to `../domain/combat`.
- (`src/components/DraftProgress.tsx`, `NameFighterForm.tsx` have NO domain imports — no change.)
- `src/screens/ChampionshipHubScreen.tsx` — rewrite for combat; show 9 stats; next opponent via v2 `generateOpponent` (`.archetype`); remove `carriedDamage`/`durability`/health-card; keep record/reign/bestReign/run-over `OutcomeBanner`.
- `src/bestReign.ts` — re-point `RunState` import to `./domain/combat`.
- `src/components/TopAppBar.tsx` — re-point `RunState` import (all fields used exist in v2 `RunState`).
- `src/components/OutcomeBanner.tsx` — re-point `FightOutcome` import to `../domain/combat` (shape identical: `{winner,method,round}`).
- `src/components/FighterHealthCard.tsx` — **reuse as-is** (its `read?` prop is a generic optional string, not tied to `opponent.style`; FightView just omits it). Not modified.
- `src/e2e.resume.test.tsx` — rewrite to assert **exact** mid-fight resume (v2), not restart.
- `src/main.tsx` — no change expected (renders `<App/>`); verify only.

**Delete (Task 7, cleanup):**
- `src/domain/fight.ts`, `opponent.ts`, `draft.ts`, `roster.ts`, `stats.ts`, `archetypes.ts`, `run.ts` and their `.test.ts` — the v1 combat domain.
- `src/domain/index.ts` (+ `.test.ts`) — the v1 barrel (after confirming nothing non-combat imports it; `createRng` stays in `src/domain/rng.ts`).
- `src/screens/RewardScreen.tsx` (+ `.test.tsx`).
- `src/screens/fightCopy.ts` (+ `.test.ts`) — v1 `opponentRead` (uses `opponent.style`).
- `src/components/IntentPanel.tsx` (+ `.test.tsx`) — replaced by IntentPanelV2.
- `src/persistence/runStorage.ts` (+ `.test.ts`) — replaced by runStorageV2.
- v1 `src/screens/FightScreen.tsx` (+ `.test.tsx`) — replaced by FightView + App wiring.
- Any component left unused after cutover (verify by grep before deleting).

**Keep (shared, do not delete):** `src/domain/rng.ts`, `src/theme/tokens.ts`, `src/components/StatBar.tsx`, `StatRow.tsx`, `FighterHealthCard.tsx`, `OutcomeBanner.tsx`, `TopAppBar.tsx`, draft components (re-pointed).

---

### Task 1: IntentPanelV2 — 3-axis RoundIntent selector

Replaces the v1 single-axis `Intent` picker. The player composes a `RoundIntent` from three axes (where / target / approach) and commits it. Additive new file — v1 `IntentPanel` untouched.

**Files:**
- Create: `src/components/IntentPanelV2.tsx`
- Test: `src/components/IntentPanelV2.test.tsx`

**Interfaces:**
- Consumes: `WHERES, TARGETS, APPROACHES, INTENT_LABELS, type Where, type Target, type Approach, type RoundIntent, PHASE_OFFENSE, STAT_LABELS, type StatLine` from `../domain/combat`.
- Produces: `export default function IntentPanelV2(props: { statLine: StatLine; onCommit: (intent: RoundIntent) => void; disabled?: boolean }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import IntentPanelV2 from './IntentPanelV2';
import type { StatLine } from '../domain/combat';

const LINE: StatLine = { striking:70, strikingDef:60, takedowns:55, takedownDef:50, submissions:40, submissionDef:45, cardio:65, chin:60, fightIQ:58 };

describe('IntentPanelV2', () => {
  it('defaults to strike/head/technical and commits that intent', () => {
    const onCommit = vi.fn();
    render(<IntentPanelV2 statLine={LINE} onCommit={onCommit} />);
    fireEvent.click(screen.getByTestId('intent-commit'));
    expect(onCommit).toHaveBeenCalledWith({ where:'strike', target:'head', approach:'technical' });
  });

  it('reflects axis selections in the committed intent', () => {
    const onCommit = vi.fn();
    render(<IntentPanelV2 statLine={LINE} onCommit={onCommit} />);
    fireEvent.click(screen.getByTestId('where-grapple'));
    fireEvent.click(screen.getByTestId('target-body'));
    fireEvent.click(screen.getByTestId('approach-pressure'));
    fireEvent.click(screen.getByTestId('intent-commit'));
    expect(onCommit).toHaveBeenCalledWith({ where:'grapple', target:'body', approach:'pressure' });
  });

  it('does not commit when disabled', () => {
    const onCommit = vi.fn();
    render(<IntentPanelV2 statLine={LINE} onCommit={onCommit} disabled />);
    fireEvent.click(screen.getByTestId('intent-commit'));
    expect(onCommit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/IntentPanelV2.test.tsx`
Expected: FAIL — cannot find module `./IntentPanelV2`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { useState } from 'react';
import {
  WHERES, TARGETS, APPROACHES, INTENT_LABELS, PHASE_OFFENSE, STAT_LABELS,
  type Where, type Target, type Approach, type RoundIntent, type StatLine,
} from '../domain/combat';

interface Props { statLine: StatLine; onCommit: (intent: RoundIntent) => void; disabled?: boolean; }

function Segmented<T extends string>(
  { group, options, value, labels, onSelect }:
  { group: string; options: readonly T[]; value: T; labels: Record<T,string>; onSelect: (v: T) => void },
) {
  return (
    <div role="group" aria-label={group} className="flex gap-xs">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          data-testid={`${group}-${opt}`}
          aria-pressed={value === opt}
          onClick={() => onSelect(opt)}
          className={`flex-1 py-sm font-mono text-xs uppercase tracking-widest border ${
            value === opt ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container text-on-surface-variant border-outline'
          }`}
        >
          {labels[opt]}
        </button>
      ))}
    </div>
  );
}

export default function IntentPanelV2({ statLine, onCommit, disabled = false }: Props) {
  const [where, setWhere] = useState<Where>('strike');
  const [target, setTarget] = useState<Target>('head');
  const [approach, setApproach] = useState<Approach>('technical');

  const offenseStat = PHASE_OFFENSE[where];

  return (
    <div data-testid="intent-panel-v2" className="w-full flex flex-col gap-sm">
      <Segmented group="where" options={WHERES} value={where} labels={INTENT_LABELS.where} onSelect={setWhere} />
      <p className="font-mono text-xs text-on-surface-variant">
        {STAT_LABELS[offenseStat]} <span className="text-on-surface">{statLine[offenseStat]}</span>
      </p>
      <Segmented group="target" options={TARGETS} value={target} labels={INTENT_LABELS.target} onSelect={setTarget} />
      <Segmented group="approach" options={APPROACHES} value={approach} labels={INTENT_LABELS.approach} onSelect={setApproach} />
      <button
        type="button"
        data-testid="intent-commit"
        disabled={disabled}
        onClick={() => onCommit({ where, target, approach })}
        className="w-full h-16 bg-primary text-on-primary font-display text-2xl uppercase tracking-wide disabled:opacity-50"
      >
        Attack
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/IntentPanelV2.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Gate + commit**

Run: `npx tsc --noEmit && npx vite build` (expect clean/ok).

```bash
git add src/components/IntentPanelV2.tsx src/components/IntentPanelV2.test.tsx
git commit -m "feat(ui): v2 RoundIntent selector (IntentPanelV2)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
git push && [ "$(git rev-parse HEAD)" = "$(git rev-parse @{u})" ] && echo PUSH_OK
```

---

### Task 2: FinishSequencePanel — the pressure-decision burst

Renders the finish window (`FightState.window`) as a short burst of high-stakes choices driving `finishStep`. Handles both window sides: `player` (hunt the finish) and `opponent` (survive). Additive new file.

**Design note (surface both sides correctly):** `finishStep` resolves toward `window.side` with probability `p` (`commit` ≈ 0.70, `measure`/`hold` ≈ 0.35, `hold`/`measure` also preserves a step). For a **player** window, `commit` = go for the finish (success ⇒ player wins). For an **opponent** window the player is being finished, so a "successful" `finishStep` means the player *loses*; therefore the panel frames the opponent window as defense — `hold`/`measure` ("cover up", lower opponent success + preserves a step) is the safe play, `commit` ("fire back") is the desperate high-risk option. Labels must make this legible. (This is the one open UX subtlety flagged to the PM; default = handle both sides as described.)

**Files:**
- Create: `src/components/FinishSequencePanel.tsx`
- Test: `src/components/FinishSequencePanel.test.tsx`

**Interfaces:**
- Consumes: `FINISH_CHOICES, type FinishChoice, type FinishWindow` from `../domain/combat`.
- Produces: `export default function FinishSequencePanel(props: { window: FinishWindow; onChoice: (choice: FinishChoice) => void; disabled?: boolean }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FinishSequencePanel from './FinishSequencePanel';
import type { FinishWindow } from '../domain/combat';

const PLAYER_WIN: FinishWindow = { side:'player', method:'KO', stepsLeft:3 };
const OPP_WIN: FinishWindow = { side:'opponent', method:'submission', stepsLeft:2 };

describe('FinishSequencePanel', () => {
  it('offers all three choices and forwards the picked one', () => {
    const onChoice = vi.fn();
    render(<FinishSequencePanel window={PLAYER_WIN} onChoice={onChoice} />);
    fireEvent.click(screen.getByTestId('finish-commit'));
    expect(onChoice).toHaveBeenCalledWith('commit');
  });

  it('shows an offensive framing for a player window', () => {
    render(<FinishSequencePanel window={PLAYER_WIN} onChoice={vi.fn()} />);
    expect(screen.getByTestId('finish-panel')).toHaveAttribute('data-side', 'player');
    expect(screen.getByTestId('finish-steps')).toHaveTextContent('3');
  });

  it('shows a defensive framing for an opponent window', () => {
    render(<FinishSequencePanel window={OPP_WIN} onChoice={vi.fn()} />);
    expect(screen.getByTestId('finish-panel')).toHaveAttribute('data-side', 'opponent');
  });

  it('does not fire when disabled', () => {
    const onChoice = vi.fn();
    render(<FinishSequencePanel window={PLAYER_WIN} onChoice={onChoice} disabled />);
    fireEvent.click(screen.getByTestId('finish-commit'));
    expect(onChoice).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/FinishSequencePanel.test.tsx`
Expected: FAIL — cannot find module `./FinishSequencePanel`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { FINISH_CHOICES, type FinishChoice, type FinishWindow } from '../domain/combat';

interface Props { window: FinishWindow; onChoice: (choice: FinishChoice) => void; disabled?: boolean; }

const OFFENSE_LABELS: Record<FinishChoice, string> = { commit: 'Commit', measure: 'Measure', hold: 'Reset' };
const DEFENSE_LABELS: Record<FinishChoice, string> = { commit: 'Fire Back', measure: 'Cover Up', hold: 'Clinch Up' };

export default function FinishSequencePanel({ window: win, onChoice, disabled = false }: Props) {
  const offense = win.side === 'player';
  const labels = offense ? OFFENSE_LABELS : DEFENSE_LABELS;
  const heading = offense
    ? `FINISH — ${win.method === 'KO' ? 'HE\u2019S ROCKED' : 'SUBMISSION IS THERE'}`
    : `DANGER — ${win.method === 'KO' ? 'YOU\u2019RE ROCKED' : 'DEFEND THE SUB'}`;

  return (
    <div
      data-testid="finish-panel"
      data-side={win.side}
      className={`w-full p-md flex flex-col gap-sm border-2 ${offense ? 'border-primary' : 'border-error'}`}
    >
      <h3 className={`font-display text-2xl uppercase tracking-wide ${offense ? 'text-primary' : 'text-error'}`}>{heading}</h3>
      <p className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">
        Window closing — <span data-testid="finish-steps">{win.stepsLeft}</span> left
      </p>
      <div className="grid grid-cols-3 gap-xs">
        {FINISH_CHOICES.map((choice) => (
          <button
            key={choice}
            type="button"
            data-testid={`finish-${choice}`}
            disabled={disabled}
            onClick={() => onChoice(choice)}
            className="py-md font-display text-lg uppercase bg-surface-container border border-outline disabled:opacity-50"
          >
            {labels[choice]}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/FinishSequencePanel.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Gate + commit**

```bash
npx tsc --noEmit && npx vite build
git add src/components/FinishSequencePanel.tsx src/components/FinishSequencePanel.test.tsx
git commit -m "feat(ui): finish-window pressure-decision panel

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
git push && [ "$(git rev-parse HEAD)" = "$(git rev-parse @{u})" ] && echo PUSH_OK
```

---

### Task 3: fightDisplay — pure display helpers

Small pure module so components never do combat math. Additive.

**Files:**
- Create: `src/fightDisplay.ts`
- Test: `src/fightDisplay.test.ts`

**Interfaces:**
- Consumes: `STAMINA_MAX, type Fighter2, type FightState` from `./domain/combat`.
- Produces: `clamp01(x:number):number`, `healthPct(f:Fighter2):number`, `staminaPct(f:Fighter2):number`, `roundLabel(s:FightState):string`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { clamp01, healthPct, staminaPct, roundLabel } from './fightDisplay';
import { STAT_IDS, type Fighter2, type FightState, type StatLine } from './domain/combat';

const LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 60])) as StatLine;
const fighter = (over: Partial<Fighter2> = {}): Fighter2 => ({
  statLine: { ...LINE, chin: 50 },
  headDamage: 0, bodyDamage: 0, stamina: 100, roundScore: 0, ...over,
});

describe('fightDisplay', () => {
  it('clamp01 bounds to [0,1]', () => {
    expect(clamp01(-1)).toBe(0); expect(clamp01(2)).toBe(1); expect(clamp01(0.5)).toBe(0.5);
  });
  it('healthPct is 1 at zero head damage and falls as damage rises', () => {
    const f = fighter(); // chin 50
    expect(healthPct(f)).toBe(1);
    expect(healthPct({ ...f, headDamage: 25 })).toBeCloseTo(0.5, 5);
    expect(healthPct({ ...f, headDamage: 999 })).toBe(0);
  });
  it('staminaPct scales stamina against STAMINA_MAX', () => {
    expect(staminaPct(fighter({ stamina: 100 }))).toBe(1);
    expect(staminaPct(fighter({ stamina: 0 }))).toBe(0);
  });
  it('roundLabel reflects phase', () => {
    const base = fighter();
    const st = (phase: FightState['phase']): FightState => ({
      seed:'s', fightNumber:1, rounds:3, round:2, phase,
      player: base, opponent: { ...base, name:'R', archetype:'boxer' },
      window: null, outcome: null, log: [],
    });
    expect(roundLabel(st('in-round'))).toBe('Round 2 of 3');
    expect(roundLabel(st('finish-window'))).toContain('Finish');
    expect(roundLabel(st('finished'))).toBe('Fight over');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/fightDisplay.test.ts`
Expected: FAIL — cannot find module `./fightDisplay`.

- [ ] **Step 3: Write minimal implementation**

```ts
import { STAMINA_MAX, type Fighter2, type FightState } from './domain/combat';

export function clamp01(x: number): number { return Math.min(1, Math.max(0, x)); }

export function healthPct(fighter: Fighter2): number {
  const chin = Math.max(1, fighter.statLine.chin);
  return clamp01(1 - fighter.headDamage / chin);
}

export function staminaPct(fighter: Fighter2): number {
  return clamp01(fighter.stamina / STAMINA_MAX);
}

export function roundLabel(state: FightState): string {
  if (state.phase === 'finished') return 'Fight over';
  if (state.phase === 'finish-window') return `Finish window · Round ${state.round}`;
  return `Round ${state.round} of ${state.rounds}`;
}
```

- [ ] **Step 4: Run + gate + commit**

```bash
npx vitest run src/fightDisplay.test.ts   # PASS (4 tests)
npx tsc --noEmit && npx vite build
git add src/fightDisplay.ts src/fightDisplay.test.ts
git commit -m "feat(ui): pure fight display helpers

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
git push && [ "$(git rev-parse HEAD)" = "$(git rev-parse @{u})" ] && echo PUSH_OK
```

---

### Task 4: FightView — presentational fight screen

A controlled view driven entirely by a `FightState` prop + callbacks. Owns no combat state (the controller in Task 6 owns `run.fight`). Renders health/stamina, then the correct input surface per `fightState.phase`: intent panel (`in-round`), finish panel (`finish-window`), or outcome + Continue (`finished`). Additive.

**Files:**
- Create: `src/screens/FightView.tsx`
- Test: `src/screens/FightView.test.tsx`

**Interfaces:**
- Consumes: `IntentPanelV2` (Task 1), `FinishSequencePanel` (Task 2), `healthPct/staminaPct/roundLabel` (Task 3), `FighterHealthCard` (existing), `OutcomeBanner` (existing, re-pointed in Task 6 but shape-compatible now), and `type FightState, type RoundIntent, type FinishChoice` from `../domain/combat`.
- Produces: `export default function FightView(props: { fightState: FightState; playerName: string; onIntent:(i:RoundIntent)=>void; onFinishStep:(c:FinishChoice)=>void; onContinue:()=>void }): JSX.Element`. Root carries `data-testid="fight-view"`, `data-round={fightState.round}`, `data-phase={fightState.phase}`, `data-player-head={fightState.player.headDamage}` (used by the resume test in Task 6).

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FightView from './FightView';
import type { FightState } from '../domain/combat';

const base = (over: Partial<FightState> = {}): FightState => ({
  seed: 's', fightNumber: 1, rounds: 3, round: 1, phase: 'in-round',
  player: { statLine: { striking:60, strikingDef:60, takedowns:60, takedownDef:60, submissions:60, submissionDef:60, cardio:60, chin:60, fightIQ:60 }, headDamage:0, bodyDamage:0, stamina:100, roundScore:0 },
  opponent: { statLine: { striking:60, strikingDef:60, takedowns:60, takedownDef:60, submissions:60, submissionDef:60, cardio:60, chin:60, fightIQ:60 }, headDamage:0, bodyDamage:0, stamina:100, roundScore:0, name:'Rival', archetype:'Boxer' },
  window: null, outcome: null, log: [], ...over,
});

describe('FightView', () => {
  it('in-round: shows the intent panel and forwards a committed intent', () => {
    const onIntent = vi.fn();
    render(<FightView fightState={base()} playerName="Me" onIntent={onIntent} onFinishStep={vi.fn()} onContinue={vi.fn()} />);
    expect(screen.getByTestId('intent-panel-v2')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('intent-commit'));
    expect(onIntent).toHaveBeenCalledWith({ where:'strike', target:'head', approach:'technical' });
    expect(screen.getByTestId('fight-view')).toHaveAttribute('data-round', '1');
  });

  it('finish-window: shows the finish panel and forwards a choice', () => {
    const onFinishStep = vi.fn();
    const st = base({ phase:'finish-window', window:{ side:'player', method:'KO', stepsLeft:3 } });
    render(<FightView fightState={st} playerName="Me" onIntent={vi.fn()} onFinishStep={onFinishStep} onContinue={vi.fn()} />);
    expect(screen.getByTestId('finish-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('finish-commit'));
    expect(onFinishStep).toHaveBeenCalledWith('commit');
  });

  it('finished: shows the outcome and Continue', () => {
    const onContinue = vi.fn();
    const st = base({ phase:'finished', outcome:{ winner:'player', method:'KO', round:2 } });
    render(<FightView fightState={st} playerName="Me" onIntent={vi.fn()} onFinishStep={vi.fn()} onContinue={onContinue} />);
    expect(screen.getByTestId('outcome-banner')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('fight-continue'));
    expect(onContinue).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/screens/FightView.test.tsx`
Expected: FAIL — cannot find module `./FightView`.

- [ ] **Step 3: Write minimal implementation**

```tsx
import { type FightState, type RoundIntent, type FinishChoice } from '../domain/combat';
import { healthPct, staminaPct, roundLabel } from '../fightDisplay';
import FighterHealthCard from '../components/FighterHealthCard';
import IntentPanelV2 from '../components/IntentPanelV2';
import FinishSequencePanel from '../components/FinishSequencePanel';
import OutcomeBanner from '../components/OutcomeBanner';

interface Props {
  fightState: FightState;
  playerName: string;
  onIntent: (intent: RoundIntent) => void;
  onFinishStep: (choice: FinishChoice) => void;
  onContinue: () => void;
}

export default function FightView({ fightState, playerName, onIntent, onFinishStep, onContinue }: Props) {
  const { player, opponent, phase, window: win, outcome } = fightState;
  return (
    <section
      data-testid="fight-view"
      data-round={fightState.round}
      data-phase={phase}
      data-player-head={player.headDamage}
      className="p-md flex flex-col gap-md items-center"
    >
      <p className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">{roundLabel(fightState)}</p>
      <div className="w-full flex gap-sm">
        <FighterHealthCard side="player" name={playerName} subtitle={`Stamina ${Math.round(staminaPct(player) * 100)}%`} badge="YOU" healthPct={healthPct(player)} />
        <FighterHealthCard side="opponent" name={opponent.name} subtitle={opponent.archetype} badge="OPP" healthPct={healthPct(opponent)} />
      </div>

      {phase === 'in-round' && (
        <IntentPanelV2 statLine={player.statLine} onCommit={onIntent} />
      )}
      {phase === 'finish-window' && win && (
        <FinishSequencePanel window={win} onChoice={onFinishStep} />
      )}
      {phase === 'finished' && outcome && (
        <div className="w-full flex flex-col items-center gap-sm">
          <OutcomeBanner outcome={outcome} heading={`${playerName} vs ${opponent.name}`} />
          <button
            type="button"
            data-testid="fight-continue"
            onClick={onContinue}
            className="w-full h-14 bg-primary text-on-primary font-display text-2xl uppercase tracking-wide"
          >
            Continue
          </button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run + gate + commit**

```bash
npx vitest run src/screens/FightView.test.tsx   # PASS (3 tests)
npx tsc --noEmit && npx vite build
git add src/screens/FightView.tsx src/screens/FightView.test.tsx
git commit -m "feat(ui): controlled FightView (intent / finish / outcome)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
git push && [ "$(git rev-parse HEAD)" = "$(git rev-parse @{u})" ] && echo PUSH_OK
```

---

### Task 5: runStorageV2 — v2 persistence layer

New storage module keyed `title-run:v2`. Same load/save/validate contract as v1 `runStorage`, minus the `reward` phase and `carriedDamage`; validates the v2 `RunState` shape (with `fight` a shallow `null | object`, since screens deref `run.fight?.outcome` via optional chaining). Additive — the App swaps onto it in Task 6.

**Files:**
- Create: `src/persistence/runStorageV2.ts`
- Test: `src/persistence/runStorageV2.test.ts`

**Interfaces:**
- Consumes: `type RunState, type RunPhase` from `../domain/combat`.
- Produces: `STORAGE_KEY='title-run:v2'`, `SCHEMA_VERSION=2`, `interface LoadedState { run: RunState|null; bestReign: number|null }`, `load():LoadedState`, `save(state:{run:RunState|null;bestReign:number|null}):void`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { load, save, STORAGE_KEY, SCHEMA_VERSION } from './runStorageV2';
import { startRun, applyDraft, type RunState } from '../domain/combat';
import { STAT_IDS, type StatLine } from '../domain/combat';

const LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 55])) as StatLine;
function preFight(): RunState { return applyDraft(startRun('seed-1'), { name: 'A', statLine: LINE }); }

describe('runStorageV2', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a valid v2 run', () => {
    const run = preFight();
    save({ run, bestReign: 3 });
    expect(load()).toEqual({ run, bestReign: 3 });
  });

  it('returns defaults when nothing is stored', () => {
    expect(load()).toEqual({ run: null, bestReign: null });
  });

  it('rejects a wrong schema version and clears the key', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, run: preFight(), bestReign: 0 }));
    expect(load()).toEqual({ run: null, bestReign: null });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('rejects a malformed run blob (phase-valid but missing fields)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, run: { phase: 'pre-fight' }, bestReign: 0 }));
    expect(load().run).toBeNull();
  });

  it('coerces a non-integer/negative bestReign to null', () => {
    save({ run: null, bestReign: null });
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, run: null, bestReign: -3 }));
    expect(load().bestReign).toBeNull();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, run: null, bestReign: 2.5 }));
    expect(load().bestReign).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/persistence/runStorageV2.test.ts`
Expected: FAIL — cannot find module `./runStorageV2`.

- [ ] **Step 3: Write minimal implementation**

```ts
import type { RunState, RunPhase } from '../domain/combat';

export const STORAGE_KEY = 'title-run:v2';
export const SCHEMA_VERSION = 2;

export interface LoadedState { run: RunState | null; bestReign: number | null; }

function defaults(): LoadedState { return { run: null, bestReign: null }; }

const KNOWN_PHASES: RunPhase[] = ['drafting', 'pre-fight', 'fighting', 'run-over'];

function isValidRun(run: unknown): run is RunState | null {
  if (run === null) return true;
  if (typeof run !== 'object') return false;
  const r = run as Record<string, unknown>;
  if (typeof r['seed'] !== 'string') return false;
  if (typeof r['phase'] !== 'string' || !(KNOWN_PHASES as string[]).includes(r['phase'] as string)) return false;
  if (!Number.isFinite(r['fightNumber'])) return false;
  if (typeof r['isChampion'] !== 'boolean') return false;
  if (!Number.isFinite(r['defenses'])) return false;
  if (typeof r['record'] !== 'object' || r['record'] === null) return false;
  const rec = r['record'] as Record<string, unknown>;
  if (!Number.isFinite(rec['wins']) || !Number.isFinite(rec['losses'])) return false;
  if (r['fighter'] !== null) {
    if (typeof r['fighter'] !== 'object' || r['fighter'] === null) return false;
    const f = r['fighter'] as Record<string, unknown>;
    if (typeof f['name'] !== 'string') return false;
    if (typeof f['statLine'] !== 'object' || f['statLine'] === null) return false;
  }
  if (r['fight'] !== null && (typeof r['fight'] !== 'object' || r['fight'] === null)) return false;
  return true;
}

export function load(): LoadedState {
  let raw: string | null;
  try { raw = localStorage.getItem(STORAGE_KEY); } catch { return defaults(); }
  if (raw === null) return defaults();
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; run?: unknown; bestReign?: unknown };
    if (parsed.version !== SCHEMA_VERSION || !isValidRun(parsed.run)) { clearKey(); return defaults(); }
    const bestReign =
      typeof parsed.bestReign === 'number' && Number.isInteger(parsed.bestReign) && parsed.bestReign >= 0
        ? parsed.bestReign : null;
    return { run: parsed.run as RunState | null, bestReign };
  } catch { clearKey(); return defaults(); }
}

export function save(state: { run: RunState | null; bestReign: number | null }): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, run: state.run, bestReign: state.bestReign }));
  } catch { /* degrade gracefully */ }
}

function clearKey(): void { try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } }
```

- [ ] **Step 4: Run + gate + commit**

```bash
npx vitest run src/persistence/runStorageV2.test.ts   # PASS (5 tests)
npx tsc --noEmit && npx vite build
git add src/persistence/runStorageV2.ts src/persistence/runStorageV2.test.ts
git commit -m "feat(persistence): v2 run storage (title-run:v2 schema)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
git push && [ "$(git rev-parse HEAD)" = "$(git rev-parse @{u})" ] && echo PUSH_OK
```

---

### Task 6: Integrating cutover — wire the v2 engine into the app

The strangler step. Re-point the shared leaf modules to `../domain/combat`, adapt the draft UI, rewrite the Hub and `App.tsx` onto the v2 `RunState` machine (controller **owns** `run.fight`), and rewrite the resume test to prove exact mid-fight restoration. v1 domain + v1 screens still exist after this task (deleted in Task 7); they simply become unused. Every sub-step ends green (`vitest`/`tsc`/`build`) and is its own commit.

**Files:**
- Modify: `src/bestReign.ts`, `src/components/TopAppBar.tsx` (+ `.test.tsx`), `src/components/OutcomeBanner.tsx`, `src/bestReign.test.ts` (if present)
- Modify: `src/screens/DraftScreen.tsx`, `src/components/RolledFighterCard.tsx`, `src/components/SlotStatusChips.tsx`, `src/screens/DraftScreen.test.tsx`
- Modify: `src/screens/ChampionshipHubScreen.tsx` (+ `.test.tsx`)
- Modify: `src/App.tsx` (+ `src/App.test.tsx`)
- Modify/replace: `src/e2e.resume.test.tsx`

**Interfaces:**
- Consumes: full v2 engine API + Tasks 1–5 (`FightView`, `runStorageV2`, `IntentPanelV2`, `FinishSequencePanel`, `fightDisplay`).
- Produces: a fully playable v2 app. `App.tsx` controller handlers: `handleIntent(RoundIntent)` → `resolveRound`; `handleFinishStep(FinishChoice)` → `finishStep`; `handleContinue()` → `settleFight`. The controller writes the engine result into `run.fight` and persists the whole `run` (exact resume). No `carriedDamage`, no reward path.

**Controller contract (verbatim — Step 4 implements this):**
- `phase==='fighting'` renders `<FightView>` driven by `run.fight`.
- `handleIntent` only acts when `run.fight.phase==='in-round'`; result written to `run.fight`.
- `handleFinishStep` only acts when `run.fight.phase==='finish-window'`.
- `handleContinue` only acts when `run.fight.phase==='finished'`; calls `settleFight(run, run.fight)` → win advances to `pre-fight` (Hub), loss → `run-over` (Hub). (`settleFight` keeps the finished `run.fight` on the returned state; the Hub is chosen by `phase`, not by `fight` presence.)
- All handlers are pure functional `setRun` updaters (engine fns are side-effect-free) — safe under StrictMode.

---

- [ ] **Step 1: Re-point shared leaf modules (bestReign, TopAppBar, OutcomeBanner) to combat**

Change imports from `'../domain'`/`'./domain'` to `'../domain/combat'`/`'./domain/combat'` in `bestReign.ts`, `TopAppBar.tsx`, `OutcomeBanner.tsx`, and their test files. No logic changes — v2 `RunState`/`FightOutcome` are shape-compatible (`isChampion`, `defenses`, `record`, `phase`, `fightNumber` all present; `FightOutcome={winner,method,round}`).

`src/bestReign.ts` line 1: `import type { RunState } from './domain/combat';`
`src/components/TopAppBar.tsx` line 1: `import type { RunState } from '../domain/combat';`
`src/components/TopAppBar.test.tsx` line 3: `import { startRun, applyDraft, type RunState } from '../domain/combat';`
`src/components/OutcomeBanner.tsx` line 1: `import type { FightOutcome } from '../domain/combat';`
`src/bestReign.test.ts` (if it imports from `./domain`): re-point to `./domain/combat`.

Run: `npx vitest run src/bestReign.test.ts src/components/TopAppBar.test.tsx && npx tsc --noEmit && npx vite build` → all green.

```bash
git add src/bestReign.ts src/bestReign.test.ts src/components/TopAppBar.tsx src/components/TopAppBar.test.tsx src/components/OutcomeBanner.tsx
git commit -m "refactor(ui): re-point bestReign/TopAppBar/OutcomeBanner to v2 combat

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
git push && [ "$(git rev-parse HEAD)" = "$(git rev-parse @{u})" ] && echo PUSH_OK
```

- [ ] **Step 2: Re-point the draft UI to combat + fix the roster field**

`src/screens/DraftScreen.tsx` — replace the two import blocks:
```tsx
import { STAT_IDS, STAT_LABELS, type StatId } from '../domain/combat';
import {
  startDraft, keepStat, nameFighter, filledCount, getDraftedFighter,
  type DraftState, type DraftedFighter,
} from '../domain/combat';
```
`src/components/RolledFighterCard.tsx` — imports become:
```tsx
import StatRow, { type StatRowState } from './StatRow';
import { STAT_IDS, type StatId } from '../domain/combat';
import { getFighter } from '../domain/combat';
import { suggestedStatId, type DraftState } from '../domain/combat';
```
and change the weight-class line (v2 `Fighter` has `archetype`, no `weightClass`):
```tsx
      <p className="font-mono text-xs uppercase tracking-widest text-on-surface-variant mb-sm">
        {fighter.archetype}
      </p>
```
`src/components/SlotStatusChips.tsx` — imports become:
```tsx
import { STAT_IDS, STAT_LABELS } from '../domain/combat';
import type { DraftState } from '../domain/combat';
```

Then **replace `src/screens/DraftScreen.test.tsx`** with a v2, seed-agnostic version (the old test asserted v1-specific fighter/stat values). Keep the StrictMode seam test's comment block verbatim (do not re-litigate PR #8):

```tsx
import { describe, it, expect, vi } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DraftScreen from './DraftScreen';
import {
  startDraft, keepStat, nameFighter, getDraftedFighter, suggestedStatId, getFighter,
  type DraftState,
} from '../domain/combat';

// Deterministically replay the "always keep the suggested stat" policy in the domain,
// so UI assertions never hardcode a v2 roster/RNG detail.
function replay(seed: string, name: string) {
  let s: DraftState = startDraft(seed);
  for (let i = 0; i < 9; i++) s = keepStat(s, suggestedStatId(s)!);
  s = nameFighter(s, name);
  return getDraftedFighter(s);
}

describe('DraftScreen (v2)', () => {
  it('keeps the screen test id for navigation', () => {
    render(<DraftScreen seed="run-42" />);
    expect(screen.getByTestId('screen-draft')).toBeInTheDocument();
  });

  it('renders the first rolled fighter and 0/9 progress', () => {
    const first = getFighter(startDraft('run-42').current!.fighterId);
    render(<DraftScreen seed="run-42" />);
    expect(screen.getByRole('heading', { name: new RegExp(first.name, 'i') })).toBeInTheDocument();
    expect(screen.getByText(/stat 0\/9 filled/i)).toBeInTheDocument();
  });

  it('plays a full draft to a named, complete fighter matching the domain', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<DraftScreen seed="run-42" onComplete={onComplete} />);
    for (let i = 0; i < 9; i++) await user.click(screen.getByTestId('suggested-stat'));
    await user.type(screen.getByLabelText(/fighter name/i), 'The Chosen One');
    await user.click(screen.getByRole('button', { name: /confirm fighter/i }));

    const expected = replay('run-42', 'The Chosen One');
    expect(screen.getByTestId('fighter-name')).toHaveTextContent('The Chosen One');
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toMatchObject({ name: 'The Chosen One', statLine: expected.statLine });
  });

  // Rendered under <StrictMode> to exercise render/initializer double-invocation
  // (render purity) and stay forward-compatible. NOTE: React 18.3.1 does NOT
  // double-invoke event-triggered setState updaters, so this test cannot go RED
  // on a call count if the onComplete side-effect is moved back INTO the setState
  // updater. The regression guard is structural: DraftScreen keeps that side-effect
  // OUT of the updater (in the handler body), which is the correct React pattern.
  it('calls onComplete once with the drafted fighter after naming', () => {
    const onComplete = vi.fn();
    render(<StrictMode><DraftScreen seed="run-42" onComplete={onComplete} /></StrictMode>);
    for (let i = 0; i < 9; i++) fireEvent.click(screen.getByTestId('suggested-stat'));
    fireEvent.change(screen.getByLabelText(/fighter name/i), { target: { value: 'Kelvin' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm fighter/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0][0]).toMatchObject({ name: 'Kelvin' });
  });
});
```

Run: `npx vitest run src/screens/DraftScreen.test.tsx && npx tsc --noEmit && npx vite build` → green.

```bash
git add src/screens/DraftScreen.tsx src/screens/DraftScreen.test.tsx src/components/RolledFighterCard.tsx src/components/SlotStatusChips.tsx
git commit -m "refactor(ui): re-point draft UI to v2 combat (archetype, 9-stat)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
git push && [ "$(git rev-parse HEAD)" = "$(git rev-parse @{u})" ] && echo PUSH_OK
```

- [ ] **Step 3: Rewrite ChampionshipHubScreen for v2**

Replace `src/screens/ChampionshipHubScreen.tsx` (removes `durability`/`carriedDamage`; `opponent.style` → `opponent.archetype`; fresh-each-fight so no carried-damage health bar):

```tsx
import {
  generateOpponent, STAT_IDS, STAT_LABELS, TITLE_FIGHT,
  type RunState,
} from '../domain/combat';
import StatBar from '../components/StatBar';
import OutcomeBanner from '../components/OutcomeBanner';

export interface HubProps {
  run: RunState | null;
  onStartRun: () => void;
  onEnterFight: () => void;
  bestReign?: number | null;
  isNewRecord?: boolean;
}

export default function ChampionshipHubScreen({ run, onStartRun, onEnterFight, bestReign = null, isNewRecord = false }: HubProps) {
  const bestReignLine = (
    <p data-testid="best-reign">{bestReign === null ? 'No title yet' : `Best reign: ${bestReign}`}</p>
  );

  if (run === null) {
    return (
      <section data-testid="screen-championship-hub" className="p-md flex flex-col items-center gap-sm">
        <h1 className="font-display text-4xl uppercase text-primary">Title Run</h1>
        {bestReignLine}
        <button data-testid="start-run" onClick={onStartRun} className="bg-primary text-on-primary font-display text-xl uppercase px-lg py-sm">Start New Run</button>
      </section>
    );
  }

  if (run.phase === 'run-over') {
    return (
      <section data-testid="screen-championship-hub" className="p-md flex flex-col items-center gap-sm">
        {run.fight?.outcome && <OutcomeBanner outcome={run.fight.outcome} heading="Run Ended" />}
        {isNewRecord && <p data-testid="new-record">★ New best reign!</p>}
        <p>Record {run.record.wins}–{run.record.losses}</p>
        <p>Reign {run.defenses}</p>
        {bestReignLine}
        <button data-testid="start-run" onClick={onStartRun} className="bg-primary text-on-primary font-display text-xl uppercase px-lg py-sm">Start New Run</button>
      </section>
    );
  }

  // pre-fight
  const fighter = run.fighter;
  const isTitle = run.fightNumber === TITLE_FIGHT;
  const isChampion = run.isChampion;
  const opponent = generateOpponent(run.seed, run.fightNumber);

  return (
    <section data-testid="screen-championship-hub" className="p-md flex flex-col items-center gap-md">
      {isChampion ? (
        <h2 className="font-display text-3xl uppercase text-primary">Champion · Reign {run.defenses}</h2>
      ) : isTitle ? (
        <h2 className="font-display text-3xl uppercase text-primary">For the Vacant Belt</h2>
      ) : (
        <h2 className="font-display text-3xl uppercase text-on-surface">Fight {run.fightNumber}</h2>
      )}

      {fighter && (
        <div className="w-full max-w-lg">
          <p data-testid="player-name" className="font-display text-2xl uppercase text-on-surface">{fighter.name}</p>
          <div className="flex flex-col gap-xs mt-sm">
            {STAT_IDS.map((s) => (<StatBar key={s} value={fighter.statLine[s]} label={STAT_LABELS[s]} />))}
          </div>
        </div>
      )}

      <div data-testid="next-opponent" className="w-full max-w-lg bg-surface-container border border-outline p-sm">
        <p className="font-mono text-xs uppercase tracking-widest text-on-surface-variant">Next opponent</p>
        <p className="font-display text-xl uppercase text-secondary">{opponent.name}</p>
        <p className="font-mono text-xs uppercase text-on-surface-variant">{opponent.archetype}</p>
      </div>

      <button data-testid="enter-fight" onClick={onEnterFight} className="w-full max-w-lg h-16 bg-primary text-on-primary font-display text-2xl uppercase tracking-wide">
        {isChampion ? 'Defend the Belt' : isTitle ? 'Fight for the Belt' : 'Enter the Octagon'}
      </button>
    </section>
  );
}
```

Replace `src/screens/ChampionshipHubScreen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ChampionshipHubScreen from './ChampionshipHubScreen';
import { startRun, applyDraft, STAT_IDS, type RunState, type StatLine } from '../domain/combat';

const LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 55])) as StatLine;
const noop = () => {};

describe('ChampionshipHubScreen (v2)', () => {
  it('null run shows title + start button + no-title reign line', () => {
    render(<ChampionshipHubScreen run={null} onStartRun={noop} onEnterFight={noop} />);
    expect(screen.getByTestId('start-run')).toBeInTheDocument();
    expect(screen.getByTestId('best-reign')).toHaveTextContent('No title yet');
  });

  it('pre-fight shows the next opponent + Enter the Octagon', () => {
    const run = applyDraft(startRun('seedH'), { name: 'Ace', statLine: LINE });
    render(<ChampionshipHubScreen run={run} onStartRun={noop} onEnterFight={noop} />);
    expect(screen.getByTestId('player-name')).toHaveTextContent('Ace');
    expect(screen.getByTestId('next-opponent')).toBeInTheDocument();
    expect(screen.getByTestId('enter-fight')).toHaveTextContent(/Enter the Octagon/i);
  });

  it('run-over shows record + reign + new-record flourish', () => {
    const run: RunState = { seed:'x', phase:'run-over', fighter:{name:'Ace',statLine:LINE}, fightNumber:6, record:{wins:5,losses:1}, isChampion:true, defenses:1, fight:null };
    render(<ChampionshipHubScreen run={run} onStartRun={noop} onEnterFight={noop} bestReign={0} isNewRecord />);
    expect(screen.getByText('Record 5–1')).toBeInTheDocument();
    expect(screen.getByTestId('new-record')).toBeInTheDocument();
  });
});
```

Run: `npx vitest run src/screens/ChampionshipHubScreen.test.tsx && npx tsc --noEmit && npx vite build` → green.

```bash
git add src/screens/ChampionshipHubScreen.tsx src/screens/ChampionshipHubScreen.test.tsx
git commit -m "feat(ui): v2 Championship Hub (fresh-each-fight, archetype, 9-stat)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
git push && [ "$(git rev-parse HEAD)" = "$(git rev-parse @{u})" ] && echo PUSH_OK
```

- [ ] **Step 4: Rewrite App.tsx onto the v2 controller + rewrite App.test.tsx**

Replace `src/App.tsx`:

```tsx
import { useEffect, useState } from 'react';
import {
  startRun, applyDraft, startNextFight, settleFight, resolveRound, finishStep,
  type RunState, type RoundIntent, type FinishChoice, type DraftedFighter,
} from './domain/combat';
import { load, save } from './persistence/runStorageV2';
import { isNewRecord as computeIsNewRecord, commitReign } from './bestReign';
import TopAppBar from './components/TopAppBar';
import ChampionshipHubScreen from './screens/ChampionshipHubScreen';
import DraftScreen from './screens/DraftScreen';
import FightView from './screens/FightView';

export interface AppProps { makeSeed?: () => string; }

export default function App({ makeSeed = () => String(Date.now()) }: AppProps) {
  const [store] = useState(() => load());
  const [run, setRun] = useState<RunState | null>(store.run);
  const [bestReign, setBestReign] = useState<number | null>(store.bestReign);

  useEffect(() => { save({ run, bestReign }); }, [run, bestReign]);

  const handleStartRun = () => {
    if (run && run.phase === 'run-over') setBestReign((b) => commitReign(b, run));
    setRun(startRun(makeSeed()));
  };
  const handleDraftComplete = (d: DraftedFighter) =>
    setRun((r) => (r ? applyDraft(r, { name: d.name, statLine: d.statLine }) : r));
  const handleEnterFight = () => setRun((r) => (r ? startNextFight(r) : r));

  const handleIntent = (intent: RoundIntent) =>
    setRun((r) => {
      if (!r || r.phase !== 'fighting' || !r.fight || r.fight.phase !== 'in-round') return r;
      return { ...r, fight: resolveRound(r.fight, intent) };
    });
  const handleFinishStep = (choice: FinishChoice) =>
    setRun((r) => {
      if (!r || r.phase !== 'fighting' || !r.fight || r.fight.phase !== 'finish-window') return r;
      return { ...r, fight: finishStep(r.fight, choice) };
    });
  const handleContinue = () =>
    setRun((r) => {
      if (!r || r.phase !== 'fighting' || !r.fight || r.fight.phase !== 'finished') return r;
      return settleFight(r, r.fight);
    });

  const showNewRecord = run !== null && run.phase === 'run-over' && computeIsNewRecord(bestReign, run);

  function screen() {
    if (run === null || run.phase === 'pre-fight' || run.phase === 'run-over') {
      return (
        <ChampionshipHubScreen
          run={run}
          bestReign={bestReign}
          isNewRecord={showNewRecord}
          onStartRun={handleStartRun}
          onEnterFight={handleEnterFight}
        />
      );
    }
    if (run.phase === 'drafting') return <DraftScreen seed={run.seed} onComplete={handleDraftComplete} />;
    // phase === 'fighting' — controller owns the serializable FightState in run.fight,
    // so a parked mid-fight run resumes EXACTLY (round, damage, stamina, window) from storage.
    if (!run.fight || !run.fighter) return null;
    return (
      <FightView
        fightState={run.fight}
        playerName={run.fighter.name}
        onIntent={handleIntent}
        onFinishStep={handleFinishStep}
        onContinue={handleContinue}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopAppBar run={run} />
      <main className="flex-1">{screen()}</main>
    </div>
  );
}
```

Replace `src/App.test.tsx`:

```tsx
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import App from './App';
import { save } from './persistence/runStorageV2';
import { startRun, applyDraft, startNextFight, STAT_IDS, type RunState, type StatLine } from './domain/combat';

const LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 55])) as StatLine;

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('App (v2 flow)', () => {
  it('fresh load shows the Hub with Start New Run', () => {
    render(<App />);
    expect(screen.getByTestId('screen-championship-hub')).toBeInTheDocument();
    expect(screen.getByTestId('start-run')).toBeInTheDocument();
  });

  it('Start New Run enters the draft', () => {
    render(<App makeSeed={() => 'seedA'} />);
    fireEvent.click(screen.getByTestId('start-run'));
    expect(screen.getByTestId('screen-draft')).toBeInTheDocument();
  });

  it('pre-fight Hub → Enter the Octagon renders the in-round FightView', () => {
    save({ run: applyDraft(startRun('seedB'), { name: 'Ace', statLine: LINE }), bestReign: null });
    render(<App />);
    fireEvent.click(screen.getByTestId('enter-fight'));
    const view = screen.getByTestId('fight-view');
    expect(view).toHaveAttribute('data-phase', 'in-round');
    expect(screen.getByTestId('intent-panel-v2')).toBeInTheDocument();
  });

  it('committing an intent advances the fight deterministically', () => {
    let run: RunState = applyDraft(startRun('seedC'), { name: 'Ace', statLine: LINE });
    run = startNextFight(run);
    save({ run, bestReign: null });
    render(<App />);
    const view = screen.getByTestId('fight-view');
    const before = view.getAttribute('data-round');
    fireEvent.click(screen.getByTestId('intent-commit'));
    const after = screen.getByTestId('fight-view');
    // either the round advanced or a finish window / finish opened — the view changed
    const changed = after.getAttribute('data-round') !== before || after.getAttribute('data-phase') !== 'in-round';
    expect(changed).toBe(true);
  });

  it('run-over Hub shows the outcome banner and Start New Run', () => {
    const lost: RunState = {
      seed: 'x', phase: 'run-over', fighter: { name: 'Ace', statLine: LINE },
      fightNumber: 2, record: { wins: 1, losses: 1 }, isChampion: false, defenses: 0,
      fight: {
        seed: 'x', fightNumber: 2, rounds: 3, round: 3, phase: 'finished',
        player: { statLine: LINE, headDamage: 40, bodyDamage: 0, stamina: 20, roundScore: 0 },
        opponent: { statLine: LINE, headDamage: 5, bodyDamage: 0, stamina: 50, roundScore: 0, name: 'Rival', archetype: 'brawler' },
        window: null, outcome: { winner: 'opponent', method: 'KO', round: 3 }, log: [],
      },
    };
    save({ run: lost, bestReign: null });
    render(<App />);
    expect(screen.getByTestId('outcome-banner')).toBeInTheDocument();
    expect(screen.getByTestId('start-run')).toBeInTheDocument();
  });
});
```

Run: `npx vitest run src/App.test.tsx && npx tsc --noEmit && npx vite build` → green. (Note: v1 `FightScreen`/`RewardScreen` are now unused but still compile — they are deleted in Task 7.)

```bash
git add src/App.tsx src/App.test.tsx
git commit -m "feat(ui): cut App over to the v2 run/combat controller

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
git push && [ "$(git rev-parse HEAD)" = "$(git rev-parse @{u})" ] && echo PUSH_OK
```

- [ ] **Step 5: Rewrite the resume e2e to prove EXACT mid-fight restoration**

This is the payoff of the controller owning `run.fight` — the v1 limitation (mid-fight parking restarted the fight from round 1) is gone. Replace `src/e2e.resume.test.tsx`:

```tsx
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import App from './App';
import { save, load } from './persistence/runStorageV2';
import {
  startRun, applyDraft, startNextFight, resolveRound,
  STAT_IDS, type RunState, type StatLine, type RoundIntent,
} from './domain/combat';

const LINE = Object.fromEntries(STAT_IDS.map((s) => [s, 55])) as StatLine;
const JAB: RoundIntent = { where: 'strike', target: 'head', approach: 'technical' };

function midFightRun(): RunState {
  let run: RunState = applyDraft(startRun('resume-seed'), { name: 'Tester', statLine: LINE });
  run = startNextFight(run);
  // advance one round while still in-round (technical/head is low-pressure — no early finish here)
  if (run.fight && run.fight.phase === 'in-round') run = { ...run, fight: resolveRound(run.fight, JAB) };
  return run;
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('mid-fight resume (v2)', () => {
  it('persists and reloads the exact in-progress FightState (deep equal)', () => {
    const run = midFightRun();
    save({ run, bestReign: null });
    expect(load().run).toEqual(run); // full run incl. run.fight round/damage/stamina survives the round-trip
  });

  it('App restores the parked fight at its saved round, not round 1', () => {
    const run = midFightRun();
    save({ run, bestReign: null });
    render(<App />);
    const view = screen.getByTestId('fight-view');
    expect(view).toHaveAttribute('data-round', String(run.fight!.round));
    expect(view).toHaveAttribute('data-player-head', String(run.fight!.player.headDamage));
  });
});
```

Run: `npx vitest run src/e2e.resume.test.tsx && npx tsc --noEmit && npx vite build` → green. (If `resolveRound` with `JAB` happens to finish the fight for this seed, pick a seed that stays `in-round` after one round — deterministic, so verify once and lock the seed.)

```bash
git add src/e2e.resume.test.tsx
git commit -m "test(e2e): exact mid-fight resume from persisted FightState

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
git push && [ "$(git rev-parse HEAD)" = "$(git rev-parse @{u})" ] && echo PUSH_OK
```

- [ ] **Step 6: Full-suite gate for the whole cutover**

Run: `npx vitest run && npx tsc --noEmit && npx vite build` → ALL green (v1 tests still present/passing; v2 tests green). If any pre-existing test references removed App/reward behavior, note it — it belongs to a v1 file deleted in Task 7; do not weaken it here, just confirm it targets a to-be-deleted module.

---

### Task 7: Cleanup — delete the dead v1 combat, reward, and storage

Now that the app runs entirely on `src/domain/combat` + the v2 UI, delete the v1 domain, v1 screens/components, and v1 storage. Keep `src/domain/rng.ts` (the engine imports `createRng` from `../rng`, not via the v1 barrel).

**Files (delete):**
- `src/domain/index.ts`, `src/domain/stats.ts`, `src/domain/archetypes.ts`, `src/domain/roster.ts`, `src/domain/opponent.ts`, `src/domain/fight.ts`, `src/domain/run.ts`, `src/domain/draft.ts` **and each `*.test.ts`** for those.
- `src/screens/FightScreen.tsx` (+ `.test.tsx`), `src/screens/RewardScreen.tsx` (+ `.test.tsx`), `src/screens/fightCopy.ts` (+ `.test.ts`).
- `src/components/IntentPanel.tsx` (+ `.test.tsx`).
- `src/persistence/runStorage.ts` (+ `.test.ts`).

**Keep:** `src/domain/rng.ts` (+ its test), all `src/domain/combat/*`, and every re-pointed/new UI file.

- [ ] **Step 1: Confirm nothing live still imports the v1 modules**

Run: `git grep -nE "from '(\.\./)*domain'" -- 'src/**/*.ts' 'src/**/*.tsx'` (v1 barrel) and
`git grep -nE "from '(\.\./)*domain/(stats|archetypes|roster|opponent|fight|run|draft)'" -- 'src/**/*.ts' 'src/**/*.tsx'` and
`git grep -n "runStorage'" -- src` and `git grep -nE "IntentPanel'|RewardScreen'|FightScreen'|fightCopy'" -- src`.
Expected: the ONLY matches are inside the files that are about to be deleted (their own imports/tests). No live file (App, FightView, Hub, Draft, bestReign, TopAppBar, OutcomeBanner, runStorageV2, the new panels) should match. If a live file matches, fix its import first.

- [ ] **Step 2: Delete the v1 files**

```bash
git rm \
  src/domain/index.ts \
  src/domain/stats.ts src/domain/stats.test.ts \
  src/domain/archetypes.ts src/domain/archetypes.test.ts \
  src/domain/roster.ts src/domain/roster.test.ts \
  src/domain/opponent.ts src/domain/opponent.test.ts \
  src/domain/fight.ts src/domain/fight.test.ts \
  src/domain/run.ts src/domain/run.test.ts \
  src/domain/draft.ts src/domain/draft.test.ts \
  src/screens/FightScreen.tsx src/screens/FightScreen.test.tsx \
  src/screens/RewardScreen.tsx src/screens/RewardScreen.test.tsx \
  src/screens/fightCopy.ts src/screens/fightCopy.test.ts \
  src/components/IntentPanel.tsx src/components/IntentPanel.test.tsx \
  src/persistence/runStorage.ts src/persistence/runStorage.test.ts
```
(Adjust the exact `.test` filenames to whatever exists — use the Step 1 grep + `git ls-files src/domain` to confirm names before removing. Do NOT remove `src/domain/rng.ts` or anything under `src/domain/combat/`.)

- [ ] **Step 3: Full gate — the app builds and every remaining test is green**

Run: `npx tsc --noEmit && npx vitest run && npx vite build`
Expected: `tsc` clean (no dangling references), `vitest` all green (only v2 + shared tests remain), `vite build` ok. If `tsc` reports an unresolved import, a live file still referenced a deleted module — re-point it to `../domain/combat` (or delete the stray file if it too is dead v1).

- [ ] **Step 4: Confirm no v1 leftovers**

Run: `git grep -nE "carriedDamage|applyReward|opponent\.style|durability|title-run:v1|from '(\.\./)*domain'([^/])" -- 'src/**/*.ts' 'src/**/*.tsx'`
Expected: **no matches** (all v1 concepts gone; only `../domain/combat` and `../domain/rng` imports remain). Also confirm `src/domain` now contains only `rng.ts` (+ its test) and the `combat/` directory.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete dead v1 combat, reward, and v1 storage (v2 cutover complete)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
git push && [ "$(git rev-parse HEAD)" = "$(git rev-parse @{u})" ] && echo PUSH_OK
```

---

## Definition of Done (whole milestone)

- App runs entirely on `src/domain/combat`; `src/domain` holds only `rng.ts` + `combat/`.
- Playable end to end: Start New Run → draft 9 stats + name → pre-fight Hub (next opponent by archetype, scaling) → fight with 3-axis intents + stamina → finish-window pressure sequence (both sides) → judges decision fallback → win advances / loss ends the run (permadeath). No reward step.
- Fixed Hub: legible pre-fight / champion / run-over states; no `carriedDamage`/`durability`.
- Exact mid-fight resume from `localStorage` (`title-run:v2`); corrupt/foreign blobs degrade to a fresh Hub (never crash).
- `npx vitest run` green, `npx tsc --noEmit` clean, `npx vite build` ok, CI `build-and-test` pass.
- Every commit carries the exact `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>` trailer.
- One PR into `main`, not merged (orchestrator + review pipeline gate before the user merges).

## Open UX decision to surface to the PM/user (from Task 2)

The finish sequence handles both window sides. For an **opponent** window (player is being finished), `finishStep` resolves toward the opponent on "success", so the panel frames it as defense: `Cover Up`/`Clinch Up` (safer, lower opponent success + preserves a step) vs `Fire Back` (`commit`, high risk). This is the recommended default. If it reads as counter-intuitive in playtest, the fallback is to only surface **player** finish windows in the wired game and auto-resolve opponent windows as a survival check — a small follow-up, not part of M8b scope.
