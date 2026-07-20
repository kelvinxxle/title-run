# M17 — Signature Strike Moves — BUILD PLAN (strict TDD)

Wave 3/3 (final) of the Immersive Fight Overhaul epic. Base: main `1a2676a` (M16 live).
Design: files/2026-07-20-m17-signature-moves-design.md. Every fact below verified vs main
`1a2676a`. Global constraints: no `Math.random` (charge + detonation fully deterministic),
no new deps, TS strict, exact commit trailer + `Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d`,
push+verify `@{u}` after every commit, ONE PR `M17: signature strike moves` into main,
**do NOT merge / do NOT deploy** (orchestrator does that), determinism verified ×2, full gate
green at the END of each coupled pair.

## Verified grounding (main 1a2676a)
- `draft.ts`: `SlotFill { value; sourceFighterId }`; `getDraftedFighter → { name; statLine;
  slots: Record<StatId,SlotFill> }` (**slots survive**). `StatId` striking key = `'striking'`
  (`PHASE_OFFENSE.strike`).
- `roster.ts`: `Fighter { id; name; archetype: ArchetypeId; signature: Partial<StatLine> }`
  — NOTE the existing `signature` field is STAT WEIGHTS, unrelated to the M17 move. Use
  distinct names (`SignatureMove`, `signatureId`, `SIGNATURE_MOVES`) to avoid collision.
  `getFighter(id): Fighter` and `fighterIdByName(name)` exist. `ArchetypeId` ∈
  striker|brawler|wrestler|grappler|allrounder (verify via archetypes.ts).
- `run.ts`: `RunFighter { name; statLine }`; `applyDraft(run,{name,statLine})` DROPS slots;
  `startNextFight → startFight({seed,fightNumber,playerStatLine,opponent})`.
- `App.tsx:27`: `applyDraft(r, { name: d.name, statLine: d.statLine })` — `d` is the
  `DraftedFighter` (HAS `d.slots`) but the call drops it. ← thread here (pass `d.slots`).
- `fightState.ts`: `FightState` (no signature state); `Fighter2` per side; `startFight`
  factory is the single build site; `opponentMove` isolated (opponent gets NO signature).
- `intents.ts`: `ExchangeMove = {kind:'strike';strike} | {kind:'takedown';takedownType}` +
  `movePhase`/`isTakedown`/`MOVE_KIND_LABELS`. `strikes.ts`: `StrikeProfile` + `STRIKES` +
  `STRIKE_PALETTE`.
- `exchange.ts`: `resolveExchange(state, move)` two-sided dominance; `crossRoundBoundary`,
  `clampStamina` exported (M16). Report via `report.ts buildRoundReport`.
- `runStorageV2.ts`: `STORAGE_KEY='title-run:v2'`, `SCHEMA_VERSION=5`; `isValidFightState`
  (:72), `isValidRun` (:140 uses it), save/load gate on `version===SCHEMA_VERSION`.
- `StrikePanel.tsx` maps `STRIKE_PALETTE`; `FightView.tsx:73` renders `<StrikePanel>`.
- Barrel `index.ts` = `export *` per module → new `signatures.ts` auto-exports once listed.

## Balance bands (re-derive empirically at PLAN strength; NEVER weaken)
B1 AGG finish ≥0.55 · B2 careless@1 ≤0.72 & gap@1 ≥0.45 & good@1 ≥0.90 · B3 good@9/@10 ≥0.45 ·
B4 good>careless every fight · B5 careless@9/@10 ≤0.42 · B6 ramp buffer ≥0.12 + tier dips ·
B7 ground-spam@9/@10 ≤0.42 (MAX over 4 takedown types) & agg-spam ≤ agg-good+0.05.
M17 adds player-only upside → only the **charge rate** (and detonation profile) may be tuned.
If a floor is unreachable without breaching a ceiling → **Achievable-floor rule** (document).

---

## T0 — Docs
Fetch design+plan from the handoff gist (`gh gist view <id> -f <file>`); commit verbatim to
`docs/superpowers/specs/` + `docs/superpowers/plans/`. No code. Commit: "T0: M17 docs".

## T1 — `signatures.ts` (signature data table + resolver) — LEAF, parallel-safe
RED: `signatures.test.ts`.
- `export interface SignatureMove { id: string; label: string; blurb: string; flavor: string;
  atkMult: number; defMult: number; power: number; koWeight: number; speed: number; }` — a
  **StrikeProfile-shaped** high-impact profile so it drops cleanly into the existing two-sided
  exchange math (target is implicitly head; staminaCost is 0 — the signature is EARNED, so T4
  passes 0 for its cost). It must be stronger than powerPunch on atkMult/power/koWeight; exact
  values set/tuned in T6. Including `defMult`+`speed` avoids the resolution path having to
  synthesize missing fields.
- `export const ARCHETYPE_SIGNATURE: Record<ArchetypeId, SignatureMove>` — 5 generic base
  moves (striker→"Check Hook", brawler→"Overhand Bomb", wrestler→"Level-Change Right",
  grappler→"Flying Knee", allrounder→"Spinning Back Kick"). Guarantees coverage.
- `export const MARQUEE_SIGNATURE: Record<string, SignatureMove>` — curated overrides keyed by
  `fighterId` for a handful (conor-mcgregor→"The Left Hand", jon-jones→"Spinning Elbow",
  anderson-silva→"Front Kick", jose-aldo→"Body-Kick Counter", … keep ≤ ~8). Additive flavor.
- `export function resolveSignature(sourceFighterId: string): SignatureMove` — MARQUEE
  override if present, else `ARCHETYPE_SIGNATURE[getFighter(sourceFighterId).archetype]`.
  Pure, deterministic, total (every roster id resolves).
Tests: every roster id resolves to a defined move; marquee ids return their override;
non-marquee ids fall to their archetype base; determinism (same id → same move).
GREEN. Commit: "T1: signatures.ts table + resolver".

## T2 — `ExchangeMove` signature variant (COUPLED with T4; inert until T4) 
RED where testable. Add `| { kind: 'signature' }` to `ExchangeMove`. Update `movePhase`
(signature→'strike'), `MOVE_KIND_LABELS` (+signature: 'Signature'), any exhaustive switch on
`m.kind` across the domain (grep `\.kind ===` on ExchangeMove consumers: report.ts, exchange.ts,
fightDisplay). Because resolution lands in T4, intermediate tsc may be non-green in isolation —
**green gate at END of T4** (squash hides it; M15/M16 precedent). Commit: "T2: ExchangeMove
signature variant (COUPLED)".

## T3 — thread `signatureId` (draft → run → fight)
RED: run.test.ts + draft/App wiring tests.
- `RunFighter` gains `signatureId: string`.
- `applyDraft(run, { name, statLine, slots })` — accept `slots`; resolve
  `signatureId = resolveSignature(slots.striking.sourceFighterId).id`; store on `RunFighter`.
- `App.tsx:27`: pass `slots: d.slots` (d is the DraftedFighter already in scope).
- `startFight` args gain `signatureId: string`; `FightState` gains `signatureId: string` +
  `signatureCharge: number` (init 0 in `startFight`). `startNextFight` passes
  `run.fighter.signatureId`.
Tests: applyDraft resolves + stores the right signatureId for a known draft; startFight sets
signatureCharge=0 + carries signatureId; RunFighter round-trips. GREEN (T3 is additive — should
typecheck alone; if the ExchangeMove switch from T2 blocks it, land T2+T3+T4 green-at-end).
Commit: "T3: thread signatureId draft→run→fight".

## T4 — charge accrual + detonation (COUPLED close of T2)
RED: exchange.test.ts.
- **Charge accrual:** in `resolveExchange`, when the player WINS a strike/takedown beat, add
  `SIGNATURE_CHARGE_GAIN` (base) `+ SIGNATURE_CHARGE_DOM * dominance` to `player.signatureCharge`,
  `clamp(0,100)`. Losing/draw = no gain (or a small base — decide in T6). Charge accrues only
  while `signatureCharge < 100` and never during a signature beat's own resolution.
- **Availability:** `export function signatureReady(state): boolean` = `signatureCharge >= 100`.
- **Detonation:** `move.kind === 'signature'` resolves through the SAME two-sided exchange path
  as a strike, using `resolveSignature(state.signatureId)` as the attacker profile (atkMult/
  power/koWeight from the SignatureMove; NO stamina cost). On resolution, RESET
  `signatureCharge` to 0 regardless of outcome (it's spent). Guard: throwing `signature` when
  `!signatureReady` throws (UI must gate it).
- Opponent never throws signature (opponentMove unchanged; no opponent charge field).
Tests (RED-first each): winning beats raise charge; charge clamps at 100; signature unavailable
<100 (guard throws); detonation uses the resolved profile + deals bigger head damage than
powerPunch on the same seed; detonation resets charge to 0; determinism ×2. GREEN — **full gate
(vitest ×2 + tsc + build) must pass at end of T4** (closes the T2 coupling).
Commit: "T4: signature charge + detonation (COUPLED)".

## T5 — signature report flavor — additive
RED: report.test.ts. `buildRoundReport` emits a dramatic headline using `SignatureMove.flavor`
when the resolved beat was a landed signature detonation (distinct from a normal strike line).
Additive; no balance impact. GREEN. Commit: "T5: signature detonation recap".

## T6 — balance harness + re-derive bands (GATE)
RED/measure: balance.test.ts. **Every policy that CAN charge a signature also throws it when
ready** — including `careless` and `wrestleSpam`. This is the M16 lesson applied: the
anti-exploit ceilings (B5 careless late, B7 ground-spam late) must measure the REAL worst case
of a charged-and-detonating mindless player, NOT a version that politely never uses its
signature. If detonation lets mindless spam breach 0.42, that is a real balance bug to tune out,
not to hide. Measure the full 10-fight table (300 seeds, GSP reference), then SET the 6+1 bands
at measured PLAN strength. Tune ONLY `SIGNATURE_CHARGE_GAIN` / `SIGNATURE_CHARGE_DOM` / the
detonation profile so all 7 bands pass — the frontier is: impactful enough that `good` feels
rewarded, weak/slow enough that charged mindless-spam stays ≤0.42 late. NEVER weaken a band.
Print the measured table in the commit body + a header comment. If the frontier is empty
(can't satisfy a floor without breaching a ceiling) → Achievable-floor rule (document, don't
weaken). Delete any interim shims.
Commit: "T6: balance — signature-aware bands (GATE)".

## T7 — persistence v5 → v6
RED: runStorageV2.test.ts. Bump `SCHEMA_VERSION` 5→6. Extend `isValidFightState` to require
`signatureCharge: number in [0,100]` + `signatureId: string`; extend `isValidRun`'s
fighter-shape check to require `signatureId: string` on a non-null RunFighter. A real
mid-signature-charge fight + a resolved run round-trip; a v5 blob (no signature fields) →
clear+defaults (graceful degrade); corrupt signatureCharge (NaN/negative/>100) → reject.
GREEN. Commit: "T7: persistence schema v6 (signature)".

## T8 — UI: signature meter + palette button + wire
RED: StrikePanel/SignatureMeter/FightView RTL tests.
- `SignatureMeter` (or extend FighterHealthCard) — visible 0..100 bar for the player, reuses
  M14 meter styling; label = the equipped `SignatureMove.label`; "READY" state at 100.
- `StrikePanel` gains a distinct **Signature** button (testid `strike-signature`) rendered only
  when `signatureReady` (glowing/primary); disabled/absent otherwise. Clicking dispatches the
  `{kind:'signature'}` move.
- `FightView` passes `signatureCharge`/`signatureId`/`signatureReady` down; App wires the
  signature move through `resolveExchange` like any other beat.
Tests: meter reflects charge; button hidden <100, shown+enabled at 100; clicking sends the
signature move; a11y (aria on meter + button). GREEN. Commit: "T8: signature meter + palette".

## T9 — full gate + dev-look
- `npx vitest run` ×2 byte-identical; `npx tsc --noEmit` clean; `npm run build` clean;
  `grep -rn 'Math.random' src` = 0; `git diff --stat origin/main -- package.json
  package-lock.json` empty; per-commit trailer audit (both trailers) = 0 missing.
- `npm run dev` dev-look: charge visibly fills; at full the Signature button appears + glows;
  detonation lands as a dramatic beat with the flavor headline + a real damage spike; charge
  resets; feels earned (not spammy). Confirm ground tree + strike palette (M15/M16) unbroken.
- Open PR `M17: signature strike moves` into main. Report: PR#, HEAD==@{u}==PR head, CI on
  exact SHA, trailer audit, RED-first evidence (T1/T4/T6/T7), measured 10-fight band table,
  changed files, determinism ×2, no-Math.random, lockfile-unchanged. **Do NOT merge/deploy.**

## Dependency graph
T0 → (T1 ∥ start) · T2+T3+T4 coupled (green-at-end of T4) · T5 after T4 · T6 after T4 (GATE) ·
T7 after T3 · T8 after T2/T3/T4 · T9 last. Parallel-safe leaves: T1, and T5/T7/T8 once their
deps land. SDD: fresh implementer + reviewer per task.
