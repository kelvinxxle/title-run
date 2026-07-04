# Design — "The Corner": Fight Feel + Between-Round Strategy + Signature Moves

Status: approved (PM self-approved under autopilot directive). Ships in two waves: **M14** then **M15**.
Repo facts verified against `main` (`829247b`, post-M13).

## Problem

The combat engine is deep but **invisible**, so the fight feels shallow and unsatisfying:

- **Health bar lies by omission.** `healthPct = 1 − headDamage/chin` — it reflects *only head damage*. The engine tracks `bodyDamage` separately (it silently drains stamina + suppresses recovery), but the bar never moves when you invest in the body. Ten flat segments, no animation, no "rocked" state; **stamina is buried as tiny subtitle text**.
- **Zero round-to-round feedback.** After you commit an intent, the engine computes `winner`, a signed `dominance`, both intents, and pre/post head damage (all present in `ResolvedContext` + `RoundLogEntry`), then throws it away. `FighterHealthCard` even has an unused `read` prop. You pick "pressure · head", hit Attack, and the bars just… change. No "you cracked him", no damage, no momentum.
- **The decisions don't reflect who you drafted.** The game's hook is drafting attributes from real fighters (McGregor's boxing, Khabib's wrestling). In the fight, that collapses to raw stats — *who* you built never shows up.

## Goal

Make the fight **feel alive and strategic**, and make *your build* matter — without throwing away the deep, well-tuned engine. Two new mechanics the user chose: **(1) between-round corner strategy** and **(2) signature moves from your draft**, plus a presentation overhaul.

## Principles

1. **Surface, don't rebuild.** The engine already computes the drama. Most of M14 is exposing existing data (`ResolvedContext`, `log`, `bodyDamage`, `stamina`, `ROCKED_HEAD_DMG`). Engine changes are additive and balance-guarded.
2. **Determinism is sacred.** No `Math.random` anywhere; all new logic seeded or pure. All juice is CSS/state-driven, not RNG.
3. **Legibility over complexity.** The recap teaches the existing tactic system by narrating it. New choices are thematic and clear.
4. **Balance is load-bearing.** M12's balance-band sim tests must stay green (or be re-tuned with evidence). Any `resolveRound` change re-runs the sim.
5. **Scope discipline.** Two waves; each is a coherent, tested, deployable vertical slice.

---

## M14 — Fight Feel + The Corner (ships first)

### A. Health system redesign (display layer)

Replace the single head-only bar with a **three-meter fighter card**:

- **HEAD** (the KO meter): `1 − headDamage/chin`. Primary/largest bar. Crosses into a **HURT** visual as `headDamage` approaches `ROCKED_HEAD_DMG(chin)` (engine's existing threshold), and a hard **ROCKED** pulse at/over it.
- **BODY**: accumulated `bodyDamage` normalized to a display cap (`bodyPct`, new helper). Communicates the body investment that is currently invisible and explains why the opponent gasses.
- **GAS** (stamina): `stamina/STAMINA_MAX` as a real meter (was tiny text). Visibly drains; low-gas gets a warning tint (reuse `isGassed`).
- **Damage flash + delta.** When a meter drops between renders, the card flashes and a floating `−N` appears (driven by the recap's per-round deltas — deterministic, from pre/post values). CSS transition on all fills.

New pure helpers in `fightDisplay.ts`: `bodyPct(fighter)`, `headState(fighter): 'fresh'|'hurt'|'rocked'`, and a `RoundReport` builder (below). Everything else is component/CSS.

### B. Round recap narration

After each exchange, before the next decision, show **what happened** — a deterministic, templated play-by-play built purely from the round's data (winner, dominance band, both intents, head/body deltas, rocked/gassed transitions). Examples:

- "You timed the counter — **big left lands. He's HURT.**"
- "He walked you down. **Body shots piling up — your gas is bleeding.**"
- "Chess match. You out-pointed him at range."

A pure `buildRoundReport(pre, post, log)` → `{ headline, detail, playerDelta, opponentDelta, momentum }` in a new `src/domain/combat/report.ts` (or `fightDisplay.ts`). No RNG, fully unit-testable on fixed inputs. This is the single biggest feedback win and doubles as the corner's narration.

### C. Momentum scorecard

A compact row of **round pips** (one per scheduled round) colored by `log[i].winner` — player / opponent / even. Lets the player feel the judged-decision stakes across a 3- or 5-round fight. Pure render off `state.log` + `state.rounds`.

### D. The Corner (mechanic #1) — new between-round phase

Add a `'corner'` phase to `FightPhase`. Flow:

- Round 1 opens directly on `in-round` (no corner before the first bell).
- When a **normal exchange resolves and the fight continues** (no finish/ground window, round advances, fight not over), `resolveRound` routes to **`phase: 'corner'`** instead of straight to `in-round`. Same for a finish-window failure that advances the round.
- The **Corner screen** shows: the **round recap** (B), the momentum scorecard (C), updated meters (A), your cornerman's read, and **3–4 game-plan cards**. Picking one calls a new pure action `chooseGamePlan(state, plan)` → stores the plan + sets `phase: 'in-round'` for the next round.
- `resolveRound` applies the stored game plan as a modifier to that exchange, then clears it.

**Game plans** (`GamePlan` union; effects applied in `resolveRound`, tuned in the balance task):

| Plan | Effect (next round) | Fantasy |
|---|---|---|
| **Push the Pace** | attack ×1.15, higher stamina burn | win now, risk gassing |
| **Work the Body** | route strike damage to body; suppresses opp. recovery | long game, break their gas |
| **Stay Disciplined** | defense ×1.15, counter-ready | protect a lead |
| **Catch Your Breath** | +recovery this round, attack ×0.85 | survive / reset |

Game plan (round posture) and the in-round intent (this exchange's attack) are **complementary layers**; the recap explains how they combined, teaching the system.

### Engine changes (additive, balance-guarded)

- `FightPhase` gains `'corner'`; `FightState` gains `gamePlan: GamePlan | null` (defaults null; persisted — bump `runStorage` version + guard, mirroring existing validation).
- `resolveRound`: on normal advance → `'corner'`; apply+clear `gamePlan`.
- New pure `chooseGamePlan(state, plan)` (throws unless `phase==='corner'`).
- App.tsx: dispatch `chooseGamePlan` on the `corner` phase; render `<CornerScreen>`.
- **Balance:** re-run the M12 sim; keep all bands green or retune with a documented table. Game-plan multipliers chosen so a neutral plan reproduces current balance.

### File map (M14)

- `src/domain/combat/fightState.ts` — `'corner'` phase, `gamePlan` field, `GamePlan` type, `chooseGamePlan`.
- `src/domain/combat/resolve.ts` — route to corner; apply game-plan modifier.
- `src/domain/combat/report.ts` (NEW) — `buildRoundReport` (pure).
- `src/domain/combat/runStorageV2.ts` — persist `gamePlan`/phase; version bump + guard.
- `src/fightDisplay.ts` — `bodyPct`, `headState`, momentum helpers.
- `src/components/FighterHealthCard.tsx` — three meters, hurt/rocked, flash.
- `src/components/RoundRecap.tsx` (NEW), `src/components/CornerScreen.tsx` (NEW), `src/components/MomentumBar.tsx` (NEW).
- `src/screens/FightView.tsx` — wire `corner` phase, recap, momentum, meters.
- `src/App.tsx` — `chooseGamePlan` dispatch.
- Tests alongside each (RED-first). Existing fight/persistence/balance tests updated as needed.

### Out of scope for M14

Signature moves (M15), new strike tactics, opponent-AI changes beyond reacting to game plans, sound, art. No change to draft/roster/opponent-gen.

---

## M15 — Signature Moves (ships right after M14)

**Idea:** each real fighter you drafted from grants a signature tied to the attribute you took (took McGregor's striking → "Left Hand From Hell"; Khabib's wrestling → "Chain Wrestling"). A **signature meter** charges over the fight (e.g., per round won / by dominance); when ready, the **Corner** offers your signature as a one-time, high-impact call with a dramatic stinger.

**Data dependency (contained):** the draft records `sourceFighterId` per kept stat (`SlotFill.sourceFighterId`), but `getDraftedFighter` → `RunState.fighter` collapses to `{name, statLine}` and drops it. M15 threads the drafted source-fighter set through `getDraftedFighter → applyDraft → RunState.fighter → startNextFight → FightState` so the fight knows your signature roster.

**Pieces:** a `fighterId → SignatureMove` map (data); `signatureMeter` + `signatureReady` on FightState; a resolve branch for playing a signature (big deterministic effect, e.g., forced finish window / guaranteed ground / heavy damage); UI in the Corner + stinger. Full design detailed at M15 planning.

---

## Sequencing & deploy

- **M14** → build (parallel subagents, strict TDD) → PR → full review pipeline (GPT-5.5 xhigh + Copilot) → self-approve → squash-merge → deploy Pages → verify live. **User can play the dramatically-improved fight here.**
- **M15** → same pipeline, layered on the Corner. Deploy.

Success = the fight *reads* clearly (you always know what happened and why), the health/gas/body state is legible at a glance, the corner adds a real strategic choice, and (M15) your drafted fighters show up in the cage. Balance bands stay green throughout.
