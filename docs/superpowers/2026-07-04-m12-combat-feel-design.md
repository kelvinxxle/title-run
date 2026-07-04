# M12 — Combat Feel: Adaptive AI + Real-Fighter Opponents — Design

**Status:** design / self-approved on autopilot. Bundles two user-requested combat changes into one milestone because **both alter fight balance and must be co-tuned once** (tuning them in separate PRs would mean tuning the bands twice). **Sequenced AFTER M11 (avatars) merges** — both touch the engine/roster, and M12b makes opponents real fighters (with real ids) which lets M11's opponent avatar key off the real id.

## Why (player feedback, verbatim)
1. "all rounders seem to be easily defeated by pressure striking every time."
2. "map opponents to real ufc fighters and give them real ufc fighter names and stats."

## Root-cause of #1 (verified on `main 8e42246`)
- The allrounder's signature stat is **fightIQ 78** (highest archetype), but fightIQ is nearly inert in combat (`(playerIQ − oppIQ) × 0.1` vs a ±24 swing). Every other archetype has a *functional* standout (striker strikeDef 74, wrestler TD-def 82, grappler sub-def 82, brawler chin 84). So the allrounder is the only archetype with **no defensive identity** — the softest target.
- **Counter** is the intended hard-counter to pressure (`STRIKE_TACTIC_DEF.counter = 1.2`, plus `COUNTER_BONUS = 10` when counter meets pressure), but `opponentIntent` picks tactics from a fixed `fightNumber`-biased RNG that **ignores the player's history**, throwing `counter` only ~10–17% of rounds and never *because* the player is pressuring. So pressure-spam is almost never punished.

---

## Feature A — Adaptive counter-reading AI (make fightIQ matter) — user chose "smart opponents read & punish predictable pressure"
**Design intent:** a high-IQ fighter *reads a predictable pressure line and counters it*. The highest-IQ archetype (allrounder) becomes the one that MOST forces you to vary Pressure / Counter / Pick-Apart; low-IQ brawlers barely adapt (still sluggers you can pressure). This gives every archetype a real identity, makes fightIQ meaningful, and removes the dominant strategy — **rewarding tactic variety, not nerfing pressure globally.**

**Mechanic (in `opponentIntent`, `fightState.ts`):**
- **Read the player's recent history from `state.log`** (last N rounds, N≈2–3): compute a `predictability` signal = how repetitive the player's recent tactic line is, weighted toward `pressure` (e.g. fraction of the last N rounds that were strike/pressure, or a pressure streak length normalized to 0..1).
- **Convert read → counter probability scaled by the opponent's fightIQ:** `counterChance = clamp( base + IQ_READ_FACTOR × max(0, oppFightIQ − IQ_MID) × predictability )`. High IQ + high predictability ⇒ high chance the opponent throws `counter` this round; low IQ ⇒ stays on its default distribution.
- If a seeded roll < `counterChance` ⇒ opponent intent = `{kind:'strike', tactic:'counter', target}`; else fall back to the **existing** fightNumber-biased distribution (unchanged).
- **Fair play:** the AI reacts only to the player's *past* rounds (`state.log`), never the current hidden intent — legitimate reading, not cheating.
- **Determinism (hard rule):** keep the M10 discipline — draw ALL rng values upfront (seed `${seed}#f${n}#ai{round}`) before branching, so consumption is branch-independent. No `Math.random`.

**Net effect:** spamming pressure into an allrounder (or any high-IQ fighter) walks into escalating counters (`+10` bonus + `1.2` def) → a losing line. Mixing tactics (or switching to wrestle / body / pick-apart) resets the read. Brawlers (IQ 54) barely read you → still pressure-able.

**Optional (only if needed for feel, keep surgical):** a *small* bump so fightIQ also lends baseline resilience — but prefer NOT to raise the global `IQ_FACTOR` (it re-tunes every matchup). Keep the fix in the AI's tactic choice.

## Feature B — Real-fighter opponents from the existing roster — user chose "reuse the 40 draft fighters as a rankings ladder, real stats"
**Design intent:** opponents are real UFC fighters with real names + their real (hand-authored) stat lines, arranged as a rankings climb from gatekeeper to champion. Zero new data — reuse `STARTER_ROSTER` (40 real fighters, `buildStatLine(fighter)` = archetype base overridden by real `signature`).

**Mechanic (replace procedural body of `generateOpponent`, `opponent.ts`):**
- Compute each roster fighter's **overall** = mean of `buildStatLine`. The roster already spans ~sub-60 gatekeepers (`journeyman-doe`, `rudy-kane`) to ~85+ elites (`jon-jones`, `khabib`, `adesanya`, `georges-st-pierre`).
- **Tier the 40 by overall** into difficulty bands. Map `fightNumber` → a target tier (early fights → low tiers; title fight + defenses → top tier). Reuse/repurpose `targetRating(fightNumber)` as the tier selector (note: the ladder's top now exceeds the old 73 cap — title fights should feel like fighting a champion; this is intended and re-tuned).
- For fight N, **deterministically draw** a not-yet-faced fighter from the target tier, seeded by `${seed}#opp{fightNumber}` (no `Math.random`). Track faced ids within a run to avoid repeats; once a run outlasts the roster (long title-defense streak), allow top-tier repeats / seeded reshuffle.
- Return the **real** `{ id, name, archetype, statLine: buildStatLine(fighter) }`. `Opponent.archetype` becomes a real `ArchetypeId` again (it already is).
- **Avatar consistency (ties into M11):** because opponents now have a real roster `id`, update the opponent avatar seed on the Hub "next opponent" + FightView opponent corner to use `opponent.id` (real) instead of `opponent.name`, so the same fighter shows the SAME procedural face when drafted and when fought.

**Difficulty note:** real stats are FIXED (not scaled to the player), so run difficulty varies with how strong a fighter you drafted — authentic and acceptable. The balance bands (measured against a fixed reference player) still gate overall tuning.

---

## Balance — co-tune both, then re-strengthen
Both features shift the fight math, so re-measure and re-tune the existing bands TOGETHER, and add invariants that lock in the fixes:
- **NEW (Feature A) anti-exploit invariant:** against a high-IQ / allrounder-tier opponent, a **pure pressure-spam line must NOT reliably win** — its win/finish rate must be meaningfully **below** a mixed/adaptive line's (assert a ceiling on pressure-spam winrate AND that mixing beats spamming by a margin). This directly encodes "allrounders punish predictable pressure."
- **NEW (Feature B) ladder invariant:** the real-fighter ladder is difficulty-monotonic-ish — early fights winnable, title-tier demanding — using real stat lines (e.g., mean opponent overall rises across the run; a strong reference player still clears early tiers at a high rate and title tiers at a bounded rate).
- **Existing bands re-tuned to stay green:** BAND1 finish ≥0.30, BAND2 careless@1 ≤0.72 + good−careless gap ≥0.20, BAND3 good@9/@10 ≥0.45, BAND4 no-runaway. Adjust knobs (AI read constants, tier→fightNumber mapping, `DMG_FACTOR`/`COUNTER_BONUS` only if required) with measured margins. Prefer tuning the NEW knobs (read constants, tier mapping) over disturbing shipped M10 constants.

## Constraints (every task)
- Deterministic, **no `Math.random` in `src/`** (seeded rng only). Client-only, offline, **no new deps** (`package.json`/lockfile unchanged). TS strict, no `any`.
- Scope: `fightState.ts` (opponentIntent), `opponent.ts` (generateOpponent), `balance.test.ts` (+ engine unit tests), `roster.ts` (additive: overall/tier helper), and the opponent-avatar seed touch-up in Hub + FightView. **No draft/persistence/roster-name changes.** Do not weaken any balance assertion below its live floor.
- Exact commit trailer `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`.

## Open tuning questions (for the build session to answer with measurements, not guesses)
- Read window N and the `IQ_READ_FACTOR` / `base` counter-chance constants (measure: pressure-spam winrate vs allrounder tiers before/after).
- Number of tiers + the `fightNumber → tier` mapping across the real rating range (~50 → ~87), so early is winnable and title is demanding while the bands hold.
- Long-run policy once the 40-fighter ladder is exhausted (top-tier repeats vs seeded reshuffle).

## Definition of Done
`vitest run` green (count up vs the M11 baseline), `tsc --noEmit` clean, `vite build` ok, no new deps, no `Math.random` in `src`. Allrounders (and any high-IQ opponent) punish pressure-spam so mixing tactics is required; opponents show real UFC names + real stats climbing gatekeeper→champion, with avatars consistent between draft and fight. One PR into `main`, CI green, exact trailers, do NOT merge (orchestrator reviews→merges→deploys).
