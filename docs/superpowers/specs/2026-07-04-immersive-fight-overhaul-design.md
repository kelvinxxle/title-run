# Immersive Fight Overhaul — Design (M15 → M16 → M17)

**Status:** Self-approved under the user's autopilot directive ("make all decisions on your own"). User is away.
**Author:** Orchestrator (PM). Grounded in the shipped M14 engine on `main`.

## Problem / Why

The fight is still shallow: **one decision per round** (a strike = head/body × pressure/counter/pickApart, or a wrestle), and the ground is **two buttons** (ground-and-pound / submission). M14 made the fight *legible* (meters, recap, momentum, the Corner), but the moment-to-moment choices are thin. The user wants the fight to be **extremely immersive**: multiple decisions per round, a real striking palette, and a deep wrestling/ground tree.

## User-chosen pillars (from brainstorming)

1. **Multi-exchange round** — a round is a sequence of **3–4 tactile exchanges**; each exchange the player picks a move, the opponent reacts, and damage/score build up beat by beat.
2. **Strike palette** — a set of **distinct strikes** (jab, power punch, body kick, leg kick, knee, elbow…), each with its own damage / speed / stamina / risk profile; **one pick per exchange**, target baked into the strike. The M14 **Corner game plan** still sets the round's tone on top.
3. **Full ground tree** — pick a **takedown type** (single leg / double leg / trip / body-lock); on success you're in a **position** (guard → half → side → mount → back); each ground beat you choose to **strike (G&P) / advance position / attempt a submission**, and **submission availability is gated by position** (rear-naked choke needs the back; armbar from mount/guard; etc.).
4. **Signature strike moves** (user add-on) — each **drafted source fighter** grants a **signature strike** (e.g. McGregor's left, a spinning back-fist) that **charges** over the fight and **detonates** as a high-impact exchange.
5. **Extremely immersive** — beat-by-beat play-by-play, visible position/state, escalating drama, fighter-specific flavor, all leaning on M14's meters/recap/momentum infrastructure.

## Design principles

- **Determinism is sacred.** No `Math.random`, no `Date` in game logic. All resolution seeded via `createRng(seedString)`. Same inputs → identical fight. (Balance sim + persistence depend on this.)
- **Reuse the M14 spine.** Keep the Corner (between rounds), the head/body/gas meters, the RoundReport recap, the momentum bar. Extend them to the exchange grain (per-exchange feedback + a round rollup).
- **Pacing over bloat.** One pick per striking exchange; the ground tree adds picks only while grounded. ~3 exchanges/round default (tunable), so a 3-round fight ≈ 9 striking beats + corners.
- **Balance is load-bearing and re-derived.** The balance sim (300-seed, good-vs-careless, BANDs) is rewritten to drive exchanges; bands re-measured empirically. Skill separation, anti-exploit ceilings, and the difficulty ramp are preserved in spirit and re-tuned to the new model.
- **Ship in coherent, playable waves.** Each wave is one PR, green gate, deployed. No wave leaves the game in a broken intermediate state.

## The exchange model (core architecture — introduced in M15)

Today `resolveRound(state, intent)` resolves an **entire round** in one call. The overhaul makes a round a loop of exchanges:

- New constant `EXCHANGES_PER_ROUND` (default **3**).
- `FightState` gains `exchange: number` (1-based index within the round) and an `exchangeLog`/beat accumulator for the current round.
- New action **`resolveExchange(state, move)`** resolves **one beat**: computes a two-sided exchange (reusing the current dominance math — attack vs defense, IQ factor, seeded swing — now parameterized by the chosen **strike profile** and the Corner game-plan modifier), applies head/body damage + stamina, records who won the beat, and produces a **per-exchange report** (extends `RoundReport`).
- After each beat: if a fighter crosses the **rocked** threshold → open a **finish-window** (as today, mid-round). Otherwise increment `exchange`; when `exchange > EXCHANGES_PER_ROUND` → tally the round score from the beats, then go to **`corner`** (or `finished` if it was the last round).
- The **Corner game plan** (M14) persists for the round and modifies every exchange in it (identity when null → round-1 first-exchange stays comparable to legacy math for a given strike).

### Striking system (M15)

- New `Strike` vocabulary replaces the per-round `StrikeTactic`. A **strike profile** carries: `power` (damage weight), `speed` (initiative / counter timing), `staminaCost`, `target` ('head' | 'body' | 'legs'), `koWeight` (head-KO potential), `counterRisk` (how exploitable if read).
- Starter palette (tunable): **Jab** (fast, low dmg, low cost, sets up), **Power Punch** (high head dmg + KO, high cost, high counter-risk), **Body Kick** (high body dmg + gas drain), **Leg Kick** (chips legs → reduces opponent stamina/mobility, low risk), **Knee** (high dmg, best when close/after pressure), **Elbow** (sharp head dmg, high cut/KO on a hurt foe). ~6 strikes.
- **Legs** as a new soft target: leg damage bleeds stamina/mobility rather than threatening a KO — rewards a "chop them down" strategy and feeds the gas meter story.
- Opponent AI picks strikes from the same palette via the existing adaptive/counter-reading logic, keyed off archetype (striker throws power/knees, wrestler mixes in level-changes).

### Ground system (M16 — detailed when built)

- `RoundIntent` gets a **takedown** move with a `takedownType` (`single-leg | double-leg | trip | body-lock`), each with success odds vs the opponent's takedown defense + its own risk (a stuffed shot = eat a counter / lose position/stamina).
- On a landed takedown → enter a **ground sub-loop** with a `position` (`guard | half-guard | side-control | mount | back`). Each ground beat: **G&P** (position-scaled damage), **advance** (attempt to pass to a better position vs opponent's guard/scramble), or **submission** (type gated by position; success scales with position quality, opponent submission defense, and gas). Opponent can **scramble/sweep/stand up**. Ground beats consume the round's exchange budget.
- Reuses the finish-window/outcome machinery for TKO (G&P) and tap (submission).

### Signature strike moves (M17 — outlined)

- **Data dependency (known):** `SlotFill.sourceFighterId` exists in the draft but `getDraftedFighter → RunState.fighter` collapses to `{name, statLine}` and drops the source IDs. M17 threads `sourceFighterId`s through `getDraftedFighter → applyDraft → RunState.fighter → startNextFight → FightState` so the fight knows which real fighters you drafted.
- Each source fighter maps to a **signature strike** (data table). A **signature meter** charges from landing strikes / winning beats; when full, a **Signature** move appears in the palette for one exchange — high impact, dramatic recap, once per charge.

## Immersion layer (woven through every wave)

- **Beat-by-beat play-by-play**: each exchange narrates ("You dig a body kick — he winces and drops his elbow"). Extends M14's `buildRoundReport` to the exchange grain, with a round-end rollup.
- **Live state you can read**: head/body/gas meters update every beat; the current **position** is shown on the ground; the **signature meter** charges visibly.
- **Escalation & drama**: rocked pulses, finish-window prompts mid-round, momentum swings, and stronger finish/round-win moments.

## Wave roadmap (each = one PR, gated, deployed)

- **M15 — Multi-exchange rounds + strike palette.** Introduces the exchange loop, the `Strike` palette + profiles, per-exchange resolution & feedback, opponent strike AI, rewritten balance sim, persistence bump. **Interim ground:** a "shoot for takedown" exchange still routes to the *existing* ground-window (G&P/submission), which cashes out the round — functional, unchanged — so the wave ships coherently. **This is the foundation everything else builds on.**
- **M16 — Full ground tree.** Replaces the interim ground with takedown types → position ladder → position-gated submissions inside the exchange loop. Re-tune balance.
- **M17 — Signature strike moves.** Thread source-fighter IDs; signature data table; charge meter; detonation exchange + dramatic recap.

## Balance approach (all waves)

- Keep the 300-seed, good-vs-careless, GSP-reference sim. Rewrite `playFight` to drive exchanges (and, in M16, the ground tree). **Re-derive** BANDs empirically: skill separation (good ≫ careless), anti-exploit ceilings (no single-strike spam dominates elite tiers), difficulty ramp (non-decreasing across tiers), finish-rate floor. Only tune the **new** knobs (strike profiles, game-plan effects, ground odds) — avoid disturbing untouched M10 constants unless the new model requires a documented re-tune.

## Out of scope / YAGNI

- No real-time input, animation engine, or art beyond CSS/state (copyright-safe; deterministic).
- No stance/southpaw system, no round-by-round judging overhaul beyond current scorecards, no multiplayer.
- No per-strike defense pick (block/slip as a separate choice) — defense stays implicit in strike choice + Corner plan, to protect pacing.

## Determinism / persistence / constraints (all waves)

- Every new random draw seeded via `createRng` with a stable key (e.g. `${seed}#f${fightNumber}#r${round}#x${exchange}`).
- `runStorageV2` schema bumps each wave that changes `FightState` shape; validators extended; in-progress runs from older schema are discarded on load (acceptable — personal project).
- No new dependencies. Strict TypeScript. Every commit trailered `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`.
