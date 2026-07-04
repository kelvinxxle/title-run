# M12 — Combat Feel: Adaptive AI + Real-Fighter Opponent Ladder (Build Plan)

**Milestone:** M12 (v2.1 combat-feel). Bundles the two user-requested combat improvements into one co-tuned PR.
**Base branch:** off `origin/main` **after M11 (avatars) merges + deploys** (M12 builds on merged `FighterAvatar`).
**Design source of truth:** `files/2026-07-04-m12-combat-feel-design.md` (locked; both features user-chosen).
**Discipline:** subagent-driven-development (fresh implementer + reviewer per task) + **strict TDD (RED first)**. Every commit: full gate green + exact trailer `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`. Push after every commit, verify `HEAD == @{u}`. One PR into `main`. **Do NOT merge.** Report back.

---

## 1. Why (user intent → design)

Two verbatim user requests after playing M10/M11:
1. **"all rounders seem to be easily defeated by pressure striking every time."** → **Feature A: adaptive counter-reading AI.** High-IQ opponents (allrounders especially) read predictable pressure from the round log and start countering it. User chose **Option A: "Smart opponents read & punish predictable pressure."**
2. **"map opponents to real ufc fighters and give them real ufc fighter names and stats."** → **Feature B: real-fighter opponent ladder.** Reuse the 40-fighter `STARTER_ROSTER` as a rating-ordered ladder; opponents are real fighters with real names, archetypes, and stats. User chose: **reuse the same 40 draft fighters as a rating-ordered ladder.**

These are **co-dependent**: Feature B seeds real high-IQ allrounder-champions into the late fights (Tier 5); Feature A makes those exact champions punish pressure-spam. Tuning them together (one balance pass) is why they ship as one milestone.

---

## 2. Verified facts (read from `origin/main @ 8e42246`; re-verify at build time on updated main)

**Combat model (`resolve.ts`):**
- `opponentIntent(state)` is called at the **top** of `resolveRound`, BEFORE this round's log entry is pushed → it reads `state.log` = rounds `1..(current−1)`. **Fair-play: it can only see PAST player intents, never the current hidden one.**
- `FightState.log: RoundLogEntry[]`, each `{ round, playerIntent, opponentIntent, winner, dominance }` — **already populated in every branch** of `resolveRound`. Feature A reads `state.log[i].playerIntent`. **No FightState shape change, no persistence change, no resume-invariant change.**
- Counter mechanics: `counterBonus` = **+10** ONLY when defender `tactic==='counter'` meets attacker `tactic==='pressure'`; plus `STRIKE_TACTIC_DEF.counter = 1.2` (best defensive multiplier). This is the exact "read & punish pressure" lever.
- `opponentIntent` seeds `createRng(\`${state.seed}#f${state.fightNumber}#ai${state.round}\`)` and **draws all rng upfront** (`roll`, `tacticIdx`) for uniform consumption. The wrestle branch (`wrestleEdge > strikeEdge`) early-returns BEFORE tactic selection — Feature A only augments the **striking** branch (countering is a striking tactic; wrestling already punishes).

**Opponent generation (`opponent.ts`):**
- `generateOpponent(seed, fightNumber): Opponent` where `Opponent = { id, name, archetype: ArchetypeId, statLine }`.
- **Only ONE production site actually spawns the fighting opponent:** `run.ts:56` in `startNextFight()`, called `generateOpponent(run.seed, run.fightNumber)`.
- The **Hub preview** (`ChampionshipHubScreen.tsx:48`) calls the SAME function with the SAME args → Hub and fight stay in sync automatically. **Rewriting `generateOpponent`'s body updates both with zero other wiring.**
- Currently uses `targetRating(fightNumber) = min(73, 66 + fightNumber)` + archetype-scaling + procedural name pools. **All of this becomes dead in Feature B** (real fixed stats replace scaling).

**Run/ladder shape (`run.ts`, `fightState.ts`):**
- `TITLE_FIGHT = 5`. `roundsForFight(n) = n >= 5 ? 5 : 3`.
- Runs are **unbounded**: `fightNumber` increments after every win; fight 5 wins the belt (`isChampion`); fights 6+ are endless title defenses (`defenses++`).
- **No past-opponent list in `RunState`** → dedup must be a **pure function of (seed, fightNumber)**, not new state.
- `FightState.opponent` is `Fighter2 & { name, archetype }` — it does **NOT** carry `id`. (Real names are unique → use `opponent.name` as the avatar identity seed; see T3.)

**Roster (`roster.ts`):**
- `STARTER_ROSTER: readonly Fighter[]` (40 real fighters), `Fighter = { id, name, archetype: ArchetypeId, signature: Partial<StatLine> }`.
- `buildStatLine(f): StatLine` = archetype base overridden by signature, clamped 1..99. `getFighter(id)`, `rollFighter(rng, excludeIds)`.
- No cycle: `roster.ts` imports only `stats`/`archetypes`/`rng`; safe for `opponent.ts` to import `roster.ts`.

**Balance harness (`balance.test.ts`):**
- Reference **PLAYER = `buildStatLine(getFighter('georges-st-pierre'))`** (fixed, elite allrounder, IQ 94).
- Opponents built via `generateOpponent(seed, fightNumber)` → **the harness automatically re-measures against real fighters once Feature B lands.**
- `careless` policy = **pure `{kind:'strike', target:'head', tactic:'pressure'}` every round** (never wrestles/rests) → `careless[9]`/`careless[10]` (currently **unasserted**) are the natural home for the anti-exploit invariant (pressure-spam vs Tier-5 champions).
- `good` policy wrestles when `takedowns − oppTakedownDef` beats the strike edge; picks pressure/counter/pickApart by stamina; commits finish windows.
- 300 seeds/fight (`balance#<policy>#<i>`), fights 1..10. Existing bands: BAND1 finish ≥0.30; BAND2 careless@1 ≤0.72 / good@1 >0.8 / gap ≥0.20; BAND3 good@9 & @10 ≥0.45 (and >0); BAND4 late-avg ≤ early-avg AND < 0.9.

---

## 3. Authoritative opponent ladder (PINNED — computed from real stats)

Overall = mean of `buildStatLine(f)` over 9 stats. 40 fighters sorted ascending, tiered into 5 × 8. **The build session MUST recompute this from the roster in-code (do not hardcode the numbers); this table is the expected result to verify against.**

| Tier | Overall range | Fighters (id) | Archetype mix | Ladder role |
|---|---|---|---|---|
| **1** | 44.9–63.1 | rudy-kane, journeyman-doe, derrick-lewis, mark-hunt, francis-ngannou, robbie-lawler, conor-mcgregor, sean-omalley | 6 brawler, 2 striker | Fight 1 — warm-up sluggers (pressure-able) |
| **2** | 65.1–68.7 | justin-gaethje, israel-adesanya, demian-maia, anderson-silva, charles-oliveira, max-holloway, jose-aldo, petr-yan | 5 striker, 2 grappler, 1 brawler | Fight 2 — strikers |
| **3** | 68.9–73.8 | chael-sonnen, robert-whittaker, frank-mir, fabricio-werdum, matt-hughes, ronaldo-souza, alexander-volkanovski, brian-ortega | 4 grappler, 2 striker, 2 wrestler | Fight 3 — grapplers |
| **4** | 74–76.4 | colby-covington, bj-penn, nate-diaz, cain-velasquez, henry-cejudo, tj-dillashaw, islam-makhachev, kamaru-usman | 5 wrestler, 2 grappler, 1 allrounder | Fight 4 — wrestlers/contenders |
| **5** | 76.7–84.7 | khabib-nurmagomedov, daniel-cormier, leon-edwards, stipe-miocic, frankie-edgar, dominick-cruz, georges-st-pierre, jon-jones | 6 allrounder, 2 wrestler | Fight 5 (title) + all defenses — champions; apex = **Jon Jones 84.7** |

This yields a natural, thematic difficulty + tactical-variety arc (sluggers → strikers → grapplers → wrestlers → champions) and places real allrounder-champions exactly at the title+defense fights, where the user felt the pressure-spam exploit.

**fightNumber → tier mapping (design intent; build session may adjust boundaries with sim data + document):**
- Fights **1→4**: Tier **1→4** (one tier per fight; each fight a distinct tier → no cross-fight repeat possible).
- Fight **5 (title) and all defenses (6+)**: Tier **5** (champions), drawn **without repeat** until the 8 champions are exhausted, then reshuffled.

**Dedup (pure, no state):**
- Fights 1–4 each draw one fighter from their (distinct) tier via `createRng(\`${seed}#opp${fightNumber}\`)` → no repeats across 1–4 (different tiers).
- Fights ≥5 index into a per-run seeded permutation of Tier 5: shuffle Tier 5 with `createRng(\`${seed}#champions#${cycle}\`)` where `cycle = floor((fightNumber−5)/8)`, index `= (fightNumber−5) mod 8`. Distinct for 8 straight defenses, deterministic, wraps with a fresh shuffle. Same `(seed, fightNumber)` ⇒ same fighter ⇒ Hub preview and fight in sync.

> Note: GSP is both the harness reference player AND a Tier-5 opponent — a mirror match at some defenses is acceptable (cosmetic). Do not special-case it.

---

## 4. Task breakdown (strict TDD; each task = full gate green + reviewed)

> **Sequencing:** T1 → T2 → T4 are **sequential** (they share the balance gate + combat determinism). **T3 is independent (UI-only, disjoint files) and SHOULD be built in PARALLEL** with T1/T2 by a separate subagent. T0 first.

### T0 — Commit design + plan (docs)
- Commit `files/2026-07-04-m12-combat-feel-design.md` + this plan to `docs/superpowers/` as the FIRST commit (before any code). Exact trailer.

### T1 — Feature A: adaptive counter-reading `opponentIntent` (`fightState.ts`)
**Goal:** a high-IQ opponent that reads repeated player pressure from `state.log` and raises its chance of throwing `counter`; low-IQ opponents barely adapt. Reacts to PAST rounds only. Determinism preserved.

**Design (augment the STRIKING branch only; leave the wrestle early-return intact):**
- Compute `predictability` from the last `N = 3` player intents in `state.log` (weight toward `strike/pressure`): e.g. fraction of recent rounds that were `{kind:'strike', tactic:'pressure'}`. Empty/short log ⇒ 0 (no read early).
- `counterChance = clamp(BASE + IQ_READ_FACTOR × max(0, oppFightIQ − IQ_MID) × predictability, 0, CAP)` (new constants; tune in T4). At IQ ≤ `IQ_MID` (e.g. brawler IQ 54) the read term is ~0 → barely adapts; at IQ 94 (Jones/GSP) it ramps fast under pressure-spam.
- Gate with an **upfront** roll. **Preference: reuse the existing `roll`** (already drawn upfront) for the counter gate to MINIMIZE determinism churn: if predictable & `roll < counterChance` → `tactic = 'counter'` (override), else fall through to the existing fightNumber-biased distribution. If the implementer instead adds a dedicated upfront `counterRoll = rng()`, that is acceptable but shifts EVERY seeded stream — see re-bless protocol.
- Keep "draw all rng upfront, unconditional" discipline. Do not read current-round player intent.

**RED-first tests (`fightState.test.ts`):**
1. High-IQ opponent (construct a `FightState` with `opponent.statLine.fightIQ = 94`) + a `log` of ≥3 prior `pressure` player rounds ⇒ `opponentIntent` returns `{kind:'strike', tactic:'counter'}` for the gating seeds (assert on a seed known to fall under `counterChance`). Was NOT counter before.
2. Low-IQ opponent (fightIQ 54), same pressure log ⇒ counter rate ≈ baseline (assert it does NOT flip to counter on that seed / stays near old distribution).
3. **Fair-play:** empty log (round 1) ⇒ behavior identical to pre-M12 (no early counter read). 
4. **Determinism:** same `(state)` ⇒ identical intent across two calls; and the per-round seed stream is unchanged in count if reusing `roll` (document if a new draw is added).
5. **Monotonic read:** more prior pressure ⇒ `counterChance` non-decreasing (unit-test the helper if extracted).

**Determinism re-bless:** running the FULL suite after T1 will shift any locked vector where a high-IQ opponent now counters. **Re-bless ONLY genuinely-shifted vectors with RE-MEASURED values (never invented).** Prove determinism (two full runs identical). Under the current still-procedural opponents (avg ≤73, no IQ-94), Feature A should fire rarely → expect small blast radius at T1; the big shift comes with T2.

**Scope:** `fightState.ts` + `fightState.test.ts` (+ re-bless touched determinism assertions in `resolve.test.ts`/`integration.test.ts`/`balance.test.ts` as measured). New tuning constants may live in `fightState.ts` or `resolve.ts` (keep them together with the other combat knobs if practical).

### T2 — Feature B: real-fighter tiered ladder `generateOpponent` (`opponent.ts`)
**Goal:** replace the procedural body with a deterministic real-fighter draw per §3. **Keep the exported signature + `Opponent` return type identical** so `run.ts` + Hub need no change.

**Implementation:**
- Compute each roster fighter's overall = mean of `buildStatLine(f)`; sort ascending; tier into 5 × 8 (derive in-code; verify against §3 table).
- Map `fightNumber → tier` per §3; draw (with the seeded dedup per §3) a `Fighter`; return `{ id: f.id, name: f.name, archetype: f.archetype, statLine: buildStatLine(f) }`.
- **Remove** `targetRating`, `FIRST/NICK/LAST`, the scaling/re-centering loop, and now-unused imports (`ARCHETYPES`, `ARCHETYPE_IDS`, `pick`, `clampStat`, `STAT_IDS` as applicable — strict TS will flag unused). Add imports from `roster.ts` (`STARTER_ROSTER`, `buildStatLine`, `Fighter`).

**RED-first tests (rewrite `opponent.test.ts`):**
1. Returns a **real** fighter: `id ∈ STARTER_ROSTER ids`, real `name`, real `archetype`, and `statLine` deep-equals `buildStatLine(getFighter(id))`.
2. **Difficulty rises:** opponent overall (or tier index) is non-decreasing across fightNumber 1→5; fights 1–4 hit tiers 1–4 respectively; fight 5 draws Tier 5.
3. **Champion at title + defenses:** fight 5 and a sample of fights 6..12 all return Tier-5 ids.
4. **Dedup:** across one run's fights 1..5 (fixed seed) all opponent ids distinct; fights 5..12 (8 defenses) distinct until wrap.
5. **Determinism / sync:** `generateOpponent(seed, n)` twice ⇒ identical; different seeds ⇒ (generally) different Tier-5 orderings.
6. Apex present: some seed path reaches `jon-jones` as a title/defense opponent.

**Balance re-tune (part of T2 DoD):** T2 makes the harness measure real opponents → the 4 existing bands shift a lot. **Re-tune to keep all existing bands green** (prefer new levers: the tier→fightNumber mapping and Feature A constants, then combat constants; **avoid disturbing shipped M10 constants unless required**). Full strengthening + new invariants happen in T4 — T2 only needs the EXISTING bands green (green-gate discipline per commit).

**Scope:** `opponent.ts` + `opponent.test.ts` (+ balance-constant retune if required to hold existing bands; document).

### T3 — Opponent-avatar identity tie-in (UI) — **PARALLELIZABLE with T1/T2**
**Goal:** real opponents get a **stable face tied to identity** — the same champion shows the same portrait in the Hub preview and the fight corner, across fights/runs. (M11 currently seeds opponent avatars by `\`${seed}#opp${fightNumber}\`` which would give the SAME real fighter different faces at different fightNumbers.)
- Since real names are unique, **seed opponent avatars by `opponent.name`** (Hub preview + FightView corner). Player + real-roster-draft avatars are unchanged.

**RED-first tests:** same opponent `name` ⇒ byte-identical avatar SVG in Hub and FightView; two different opponent names ⇒ different SVGs. (Reuse the M11 avatar test patterns.)

**Scope:** `ChampionshipHubScreen.tsx` + `FightView.tsx` + their tests only. Engine untouched. **Cut this task if it introduces any engine/persistence risk** — it is a polish tie-in, not core to either user request.

### T4 — Co-tuned balance: strengthen bands + new anti-exploit & monotonic invariants (`balance.test.ts` + constants)
**Goal:** with Feature A + real ladder both present, re-measure everything and lock the strengthened guarantees. **The sim is ground truth. Never weaken a band trivially; when a target is genuinely unreachable, apply the Achievable-floor rule (measure the live value, set the assertion just inside it, and DOCUMENT why in a comment).**

**Preserve/strengthen existing bands (re-home the discriminating ones):**
- **BAND1 finish rate ≥ 0.30** (good, aggregate) — keep global.
- **BAND4 no-runaway** (late-avg ≤ early-avg AND < 0.9) — keep global.
- **BAND2/BAND3 discriminating assertions:** fight 1 is now a **designed warm-up vs a Tier-1 gatekeeper** (overall 45–63) against the elite GSP reference player → `careless@1 ≤ 0.72` and the `good−careless@1 gap ≥ 0.20` may be **unreachable** (an elite beats a scrub even carelessly; good & careless both ~high ⇒ small gap). **Re-home these "careless is punished / skill separates" assertions to the fights where skill actually matters** (mid/late, Tier 4–5, where Feature A bites), documenting the relocation with measured values. Keep `good@1 > 0.8` (trivially holds vs Tier 1). Keep `good@9 & @10 ≥ 0.45` but Achievable-floor if real champions (Jones 84.7 > old cap 73) push it under — GSP's 90 takedowns/94 IQ should still thread ≥0.45 via wrestling exploitable champions.

**ADD new invariants (the heart of M12):**
- **BAND5a — anti-exploit:** `careless[10].winRate ≤ CEILING` (pressure-spam cannot reliably win title defenses vs high-IQ champions). Also assert at fight 9. Set CEILING from measurement (target meaningfully < good; Achievable-floor if needed).
- **BAND5b — skill separation late:** `good[N].winRate − careless[N].winRate ≥ GAP` at N ∈ {9,10} (mixing/reading beats spamming vs champions). This is the direct encoding of the user's fix: predictable pressure is punished by smart late opponents.
- **BAND6 — difficulty-monotonic ladder:** `good[n+1].winRate ≤ good[n].winRate + NOISE` for n = 1..9 (winrate non-increasing as the real ladder rises, within sim noise).

**Tuning levers (prefer top-down):** (1) tier→fightNumber mapping / tier boundaries; (2) Feature A constants (`BASE`, `IQ_READ_FACTOR`, `IQ_MID`, `CAP`, window `N`); (3) combat constants (`COUNTER_BONUS`, tactic multipliers) — only if 1–2 insufficient; **avoid touching shipped M10 constants unless required, and document any change.**

**Scope:** `balance.test.ts` + whichever constants file holds the tuned knobs. Re-run 300-seed sim; report the measured band table.

### Final gate (report all)
- `npx vitest run` all green — report count vs M11 baseline (214) and the delta; **run twice, identical** (determinism).
- `npx tsc --noEmit` clean (strict, no `any`); `npm run build` ok (exact CI scripts).
- `grep -rn 'Math.random(' src` = **0** (note: pre-existing literal in 2 comment lines is fine; assert 0 actual invocations).
- `package.json` + lockfile **unchanged** vs base; no new deps.
- Per-commit trailer audit (all commits carry the exact `Copilot App` trailer).
- **Measured balance table** (all bands + new invariants, with any Achievable-floor documented).
- RED-first evidence per novel-logic task (T1 adaptive counter, T2 real ladder, T4 anti-exploit).

---

## 5. Scope guards / non-goals
- **Do NOT** change `FightState` shape, `run.ts` (beyond nothing — `generateOpponent` swap is internal), persistence schema/validation, or the M4/M8/M10 UI wiring. Feature A reads existing `log`; Feature B swaps `generateOpponent`'s body; both are internal.
- **No `Math.random`** anywhere; all randomness via `createRng` seeded streams.
- **No new dependencies**; no `package.json`/lockfile change.
- **No visual juice/feel** (animation/sound) — that remains the deferred fast-follow.
- Keep each PR-commit green; do not batch unrelated changes; do not gold-plate (resist adding knobs/tests beyond the DoD).
- **Determinism re-bless = measured, never invented.** Two identical full runs required.

## 6. Flags for the build session
- **T1 rng strategy:** prefer reusing the existing upfront `roll` for the counter gate to minimize determinism churn; if you add a dedicated `counterRoll`, expect and re-bless a broader vector shift.
- **careless@1 / gap@1 relocation:** fully expected under the real ladder (elite reference vs Tier-1 warm-up). Re-home the discriminating assertions to mid/late fights with measured values; do not weaken the SPIRIT (skill/reading is rewarded where it matters).
- **BAND3 vs Jon Jones (84.7):** if good@9/@10 dips under 0.45 because champions now exceed the old 73 cap, Achievable-floor with a documented measured value — but first try the wrestling lever (GSP takedowns 90).
- **T3 is optional polish** and parallelizable; cut it if it risks the engine/persistence.
- Report: PR#, final HEAD, `HEAD==@{u}`, CI on exact SHA, per-commit trailer audit, RED-first evidence, measured band table, and any Achievable-floor/relocation decisions.
