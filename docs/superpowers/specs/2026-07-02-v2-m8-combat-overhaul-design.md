# Title Run v2 — M8: Combat Overhaul (design spec)

**Status:** Approved (brainstorm locked 2026-07-02) — ready for build plan
**Milestone:** M8 (first of two v2 milestones; M9 = roster/content)
**Author:** PM/orchestrator (chat), with the user
**Depends on:** v1 (M1–M7) merged + live on Pages (`main` @ `cf4d643`)

---

## 1. Why (problem statement)

v1 is feature-complete and shipped, but the **fight itself is not fun**. Concretely, from the user:

1. **Finishes almost never happen** — this is *the* core problem. Bouts devolve into a dull health-bar grind that ends on an unsatisfying decision.
2. **Decisions don't matter early** — the opening fights are near-autopilot; you can win without thinking.
3. **Balance is inverted** — too easy early, then a reward-driven **snowball** makes the player runaway-strong, while opponents scale into an **unbeatable wall around fight 9+**.
4. **Winning isn't satisfying** — weak feedback, no highlight moment.
5. **Reward system is too steep** and its screen is broken ("a blank canvas with word-buttons").
6. **The Hub/home screen is broken.**

**v2 thesis:** Make the **fight a deep tactical puzzle where finishes are the satisfying highlight**, and remove the systems (rewards) that break balance. Realism (real fighters, offense + defense) is core, but is sequenced into M9 so combat can be proven first.

## 2. What we're building (M8 scope)

The **entire new fight** on a **small starter roster**, shipped and playable:

- New **9-stat model** (offense + defense across striking/wrestling/grappling, plus cardio/chin/fight-IQ).
- **Richer round loop**: where-to-fight + target + approach sub-choices per round.
- **Stamina** as the core resource and balance lever.
- **Finish system**: windows that open via accumulated damage **or** a tactical read, resolved by a **pressure-decision** finish sequence.
- **Judges/scorecards** fallback when no finish.
- **Remove post-fight rewards entirely** (deletes the reward screen + the reward flow).
- **Fix the difficulty curve** (early decisions matter; late fights hard-but-beatable; no snowball).
- **Fix the broken Hub** (functional + legible; not a visual redesign).
- **Small starter roster** (~6–10 real fighters spanning archetypes + one deliberately weak) — enough to exercise and tune the model.

## 3. Out of scope (M8)

- **The full 45–60+ real-fighter roster** → **M9** (content + final tuning against the locked M8 model).
- **Juice/feel polish pass** (animation, sound design, richer visual feedback beyond legible/functional) → **fast-follow after v2**.
- PWA/native app, multiplayer, accounts, any backend. (Client-only, localStorage — unchanged.)
- No full visual redesign of existing screens beyond repairing the broken Hub and removing the reward screen.

## 4. Stat model (9 stats, offense + defense)

Symmetric across the three fighting phases, plus three attributes:

| Phase / attribute | Offensive stat | Defensive stat |
| --- | --- | --- |
| Striking | **Striking** (power/accuracy on the feet) | **Striking Defense** (evasion/head movement) |
| Wrestling | **Takedowns** (takedown offense) | **Takedown Defense** (stuff takedowns, stay standing) |
| Grappling | **Submissions** (ground offense / sub attempts) | **Submission Defense** (defend/escape subs) |
| Attribute | **Cardio** (stamina pool + recovery rate) | — |
| Attribute | **Chin** (durability — damage tolerated before "rocked"/KO) | — |
| Attribute | **Fight IQ** (tilts close reads, finish windows, decision scoring) | — |

- **Draft mechanic unchanged**: roll a real fighter → keep one of their stats → repeat until the sheet is full → name the fighter. (Same loop as v1 M3, just this 9-stat sheet.)
- All stats are integers on the existing 1–99 scale (reuse v1 conventions/clamps).

## 5. The round (tactical puzzle)

Each round the player composes a game plan from independent sub-choices:

1. **Where to fight:** `Strike` / `Wrestle` (attempt takedown) / `Grapple` (ground game, when applicable).
2. **Target:** `Head` (builds toward rocked/KO) or `Body` (drains opponent cardio, sets up later rounds).
3. **Approach:** `Pressure` (high damage, high stamina cost, more exposed defensively) / `Technical` (balanced) / `Counter` (low stamina cost, punishes opponent aggression, more likely to open a read-based finish).

**Resolution:** outcome is a deterministic function of the player's relevant stats + choices vs the opponent's stats + choices, tilted by **Fight IQ**, consuming **stamina** according to the approach/phase. Produces: damage dealt/taken, stamina spent/recovered, round scoring, and possibly an opened finish window. (Determinism/seed architecture from v1 M4 is preserved — see §11.)

## 6. Stamina (core balance lever)

- Each fighter has a **stamina pool derived from Cardio**; it depletes as the fight goes on.
- **Pressure** and **Wrestling** cost more stamina; **Counter**/**Technical** cost less; partial **recovery between rounds** (scaled by Cardio).
- **Gassing out** (low stamina) sharply reduces effective offense AND defense → you become finishable, and a **gassed opponent opens a read-based finish window** for you.
- This is the mechanism that makes **early decisions matter** (you can't mindlessly pressure) and gives the run a fair, self-correcting difficulty.

## 7. Finish system (the highlight)

**Window opens when EITHER:**
- **Damage path:** accumulated **head** damage pushes the opponent past their **Chin** threshold → "rocked."
- **Read path:** a decisive tactical read lands — a clean **Counter**, catching a **takedown attempt into a submission**, or capitalizing on the opponent being **gassed**.

**Finish sequence** (when a window is open): a short burst of **1–3 escalating pressure-decisions**, e.g. `commit to the KO shot` / `posture up for ground-and-pound` / `tighten the choke`. Each has risk:
- **Correct read** → the finish lands (KO or submission) — a big, satisfying end-of-fight moment.
- **Misread** → the opponent **recovers/escapes**, the window closes, and you pay a stamina/position cost.

**Tuning intent:** finishes must happen **often enough to feel great** for a skilled player — the explicit fix for "finishes never happen." (Concrete target rates are set during build tuning; success criteria in §12.)

## 8. Judges / decision fallback

- If no finish by the final bell, **scorecards** decide the winner from **accumulated per-round scoring** (effective damage, control/where-the-fight-happened, aggression), tilted by Fight IQ on close rounds.
- **Round format unchanged from v1:** 3 rounds for normal fights; **5 rounds for the title fight and title defenses.**

## 9. Run structure (rewards removed)

- **Draft** the fighter (§4 mechanic).
- Climb the ladder of opponents; **belt at fight 5**; **title defenses** thereafter; **permadeath on first loss** (unchanged from v1).
- **Fighter is fixed for the whole run**; **every fight starts fresh** (full health + stamina). Progression = **rising opponent skill only** — no player-side power growth.
- **No rewards between fights.** The Post-Fight Reward screen and reward application flow are **removed entirely** (this also deletes the broken reward UI).
- **Score = successful title defenses (reign)**; **best reign persisted** (keep v1 M7 persistence + best-reign record + new-record celebration).

## 10. Difficulty philosophy (the fix)

Removing rewards eliminates the player-side snowball; fresh-each-fight + fixed power eliminates the runaway in both directions. The remaining lever is the **opponent ladder**:

- **Early fights:** opponents are weak, **but a careless player still loses** — gassing out, ignoring defense, or bad targeting can cost the fight. **No decision-less autopilot wins.**
- **Ramp:** opponent skill rises **smoothly**; late opponents are **hard but always beatable with good tactical play** — **no stat wall** where good play can't win.
- **Net:** a skilled player can plausibly reach and defend the belt; a careless one loses early.

## 11. Non-negotiable architecture constraints (carried from v1)

- **Client-only, no backend, localStorage persistence.** No new runtime deps beyond react + react-dom unless justified and approved.
- **Pure, deterministic, seeded domain layer** (`src/domain/`), fully unit-tested; React UI (`src/screens`, `src/components`) gets lighter RTL tests. Same-seed → same fight outcome given the same intents.
- Serializable `RunState` (persistence/park-resume must keep working). The v1 mid-fight-resume limitation (FightScreen owns transient round state) may be revisited but is **not required** to change in M8 unless the new round model makes it natural.
- Existing **Octagon Elite** design system + theme tokens reused (background `#0e0e0e`, primary `#f2ca50`).
- Every commit trailered `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`.

## 12. Success criteria (M8 "done")

1. A full run is playable end-to-end on the small starter roster (draft → fights → belt at 5 → defenses → loss ends run), on desktop and iPhone (390px).
2. **Finishes are attainable and satisfying:** a skilled player finishes a meaningful fraction of fights via the pressure-decision sequence (target rate set in tuning, e.g. finishes are clearly *not* rare); the finish is a distinct highlight moment, not a silent health-bar hit.
3. **Every round is a real decision:** where/target/approach + stamina management measurably change outcomes; there are no autopilot wins even in fight 1.
4. **Curve is fair:** early fights punish careless play; late fights are hard but beatable with good play; there is no unwinnable wall and no runaway snowball.
5. **Rewards are gone:** no reward screen, no between-fight power growth; the broken reward UI no longer exists.
6. **Hub works:** the home/Hub screen renders correctly and legibly for all run states (climbing / champion / run-over).
7. Persistence still works (autosave + resume + best-reign record + new-record celebration).
8. Domain layer is pure/seeded/unit-tested; determinism preserved; no `Math.random` in `src`.

## 13. Open tuning questions (resolved during build, not blockers)

- Exact stamina costs/recovery per approach; exact Chin→rocked thresholds; exact finish-window probabilities and finish-sequence length (1–3).
- Exact starter-roster fighters (~6–10) and their stat lines / archetypes (striker, wrestler, grappler, all-rounder, weak).
- Exact opponent-ladder scaling curve (per fight number) to satisfy §10 and §12.4.
- Whether "Grapple" is a standalone where-choice or only reachable via a successful takedown (positional flow) — a build-time model detail kept legible.

These are numeric/content tuning knobs, deliberately left to the build so we tune against the real engine rather than guess up front.
