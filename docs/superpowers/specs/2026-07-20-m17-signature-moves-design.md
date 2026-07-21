# M17 — Signature Strike Moves (design)

Wave 3/3 of the Immersive Fight Overhaul epic. Base: main `1a2676a` (M16 live).
Self-approved under autopilot; posted to user as a non-blocking veto window.

## Why
The epic's final promised beat: your **drafted fighters** should leave a fingerprint on
the fight. Right now the draft picks source fighters (`SlotFill.sourceFighterId`) but the
fight never knows who you built from — `applyDraft` collapses the draft to `{name,statLine}`.
M17 threads that identity through and turns it into a **signature strike** that **charges**
over the fight and **detonates** as one high-impact exchange with a dramatic recap.

## Grounded facts (verified vs main 1a2676a)
- `draft.ts`: `SlotFill { value; sourceFighterId }`; `getDraftedFighter` returns
  `DraftedFighter { name; statLine; slots: Record<StatId, SlotFill> }` — **slots (with
  source IDs) survive the draft.** The design-doc note that getDraftedFighter drops IDs was
  imprecise; the real drop is one layer down.
- `run.ts`: `RunFighter { name; statLine }`; `applyDraft(run, {name,statLine})` **drops
  slots**; `startNextFight` → `startFight({seed,fightNumber,playerStatLine,opponent})` — no
  signature channel. ← the two threading points.
- `fightState.ts`: `FightState` carries per-fighter `Fighter2`, phase, window, `gamePlan`,
  `lastReport`, `ground`. No signature state. `startFight` factory is the single construction
  site. Opponent AI is isolated in `opponentMove`.
- `intents.ts`: `ExchangeMove = {kind:'strike';strike} | {kind:'takedown';takedownType}` —
  a clean union to extend. `strikes.ts`: `StrikeProfile` (atkMult/defMult/power/staminaCost/
  koWeight/speed) + `STRIKES` table + `STRIKE_PALETTE`.
- Persistence schema is at **v5** (M16). Balance gate = 7 bands (B1–B7) in `balance.test.ts`.

## Scope decisions (PM calls — kept deliberately tight)

1. **ONE signature per run** (not one-per-drafted-fighter). Keeps the palette, meter, and
   drama singular and legible. "Draft-tied" is honored by *deriving which* signature from
   your draft, not by stacking many.

2. **Derivation = the source fighter of your STRIKING slot**, then resolved to a signature.
   Thematic: your signature *strike* comes from the striker whose hands you kept. Fully
   deterministic from the draft.
   - Resolution order: (a) a small **curated marquee table** keyed by `fighterId` for a
     handful of iconic fighters (e.g. mcgregor→"The Left Hand", jones→"Spinning Elbow",
     silva→"Front Kick", pettis→"Showtime Kick", aldo→"Body-Kick Counter") → overrides;
     (b) else **archetype-generic** signature by that source fighter's archetype
     (striker / brawler / wrestler / grappler / allrounder). Guarantees every run gets a
     signature; the curated table is additive flavor, not a 40-row obligation.
   - Player custom fighter has no `id`/`archetype`, but the Striking slot's `sourceFighterId`
     IS a real roster id → we look up that fighter's archetype from the roster. Robust.

3. **Charge → detonate.** New `signatureCharge` (0..100) on the player side. Fills on
   **winning a beat / landing a strike** (charge gain scaled modestly by dominance). At 100
   the signature unlocks in the StrikePanel as a distinct **Signature** button for ONE
   exchange. Throwing it resolves like a strike using the signature's high-impact profile
   (big atkMult/power/koWeight), then **resets charge to 0**. Once per charge; re-charges.

4. **`ExchangeMove` gains `{kind:'signature'}`.** Resolves through the existing two-sided
   exchange math with the signature profile (target head). No new resolution path — it's a
   strike with a special profile + charge gate + recap flavor.

5. **Opponent has NO signature** (documented scope cut, mirrors M16's "opponent bottom game
   out of scope"). Player-only keeps balance one-sided and tunable.

6. **Persistence schema v5 → v6.** `FightState` gains `signatureCharge` + `signatureId`
   (the equipped signature); `RunFighter` gains `signatureId` (resolved once at `applyDraft`).
   Validate both; v5 blobs → clear+defaults (graceful degrade, per prior milestones).

7. **Immersion:** the signature meter charges *visibly* (reuse M14 meter infra); when full
   the button glows; detonation produces a dramatic `RoundReport` headline
   (fighter-specific flavor line). This is the epic's "fighter-specific flavor" payoff.

## Balance
Signature is player-only and charge-gated (≈ once per fight at plausible charge rates), so it
nudges the player's finish rate up. **Re-derive all 7 bands; never weaken.** The single
tuning knob is the **charge rate** (and secondarily the detonation profile). Anti-exploit
ceilings (B5 careless late ≤0.42, B7 ground-spam late ≤0.42) must still hold — signature must
not become a metronomic finish button. If a target is unreachable without breaking a ceiling,
apply the **Achievable-floor rule** (document, don't weaken).

## Out of scope (v-next / fast-follow)
- Opponent signatures; multiple simultaneous signatures; per-fighter bespoke tables for all 40;
  animation/sound juice (the deferred feel polish); any engine change beyond the signature path.

## Global constraints (unchanged)
No `Math.random` (charge + detonation fully deterministic); no new deps; TS strict; exact
commit trailer + session trailer; ONE PR into main; do-not-merge/do-not-deploy (orchestrator).

## Data threading (the spine)
`SlotFill.sourceFighterId` (Striking slot) → resolve `signatureId` at **`applyDraft`** →
`RunFighter.signatureId` → **`startFight`** arg → `FightState.signatureId` (+ `signatureCharge:0`).
Two small signature-aware call-site edits (`applyDraft`, `startNextFight`/`startFight`); the
rest is additive (`signatures.ts` table, `ExchangeMove` variant, charge accrual in exchange
resolution, StrikePanel button, report flavor, persistence v6).
