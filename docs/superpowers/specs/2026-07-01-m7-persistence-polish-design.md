# M7 — Persistence & Polish (Design Spec)

**Milestone:** M7 of 7 (final) · **Status:** design authored autonomously by the orchestrator-as-PM; assumptions flagged for user course-correction
**Date:** 2026-07-01
**Depends on (merged):** M1–M5 merged; **M6 (run/rewards) must be merged first** — M7 builds off the M6 merge commit.
**Base:** `origin/main` @ the M6 squash-merge commit (TBD at build time; not `184a827`).

> **Autonomy note:** The user delegated full product ownership ("drive the development of the entire project") and merge authority. I made the product calls below myself, aligned to the PRD's Cognitive Interface Model (park/resume, specific feedback, recoverability). Each non-obvious call is marked **[PM call]** with reasoning so the user can override on return.

---

## 1. Why we're building this

The PRD's headline promise — *"quit anytime and resume exactly where you left off"* — and its scoring hook — *"if a run beats your local best, it's celebrated"* — are the two things M1–M6 deliberately deferred. M6 made `RunState` a pure, serializable machine precisely so M7 can persist it with near-zero rework. M7 is the milestone that makes runs durable across sessions and gives a completed run a payoff. It's the last milestone; after M7 the game is feature-complete per v1 scope.

## 2. Goals

- **Park & resume to exact state:** closing/reopening the app (or a reload) restores the run to the exact phase, fighter, fight number, carried damage, record, and champion/reign state.
- **Best-reign memory + celebration:** the longest title reign persists across runs; ending a run that beats it is celebrated on the end screen.
- **Robust, invisible persistence:** autosave is automatic and silent; corrupt or stale saves never crash the app (graceful fallback to a fresh state).
- **Feature-complete v1:** an end-to-end integration test proves the full loop — draft → climb → belt → defense → loss → resume → new record — works through the real UI.

## 3. Scope

### In scope (M7)
1. **`src/persistence/runStorage.ts`** — a thin, well-tested localStorage adapter: load/save a versioned blob `{ version, run, bestReign }`, with validation and safe degradation.
2. **App autosave + hydrate** — `App` initializes from storage on mount and writes on every run change.
3. **Best-reign tracking** — `bestReign: number | null` carried in App state, persisted, and committed across runs; drives the end-of-run celebration.
4. **End-of-run celebration** — the M6 run-over Hub view gains a "new best reign" flourish (additive prop; no rework of M6's run machine).
5. **End-to-end integration test** — a full deterministic run through the real `App`, including a simulated reload that asserts exact resume, and a best-reign record.

### Out of scope (v1 complete after M7)
- Accounts, cloud sync, online leaderboards (PRD out-of-scope).
- Multiple save slots (single active run + single best-reign only).
- Sound, animation, or heavy end-of-run cinematics (PRD: "no sound/music"; celebration stays a text/visual flourish).
- Undo/history of past runs (only the current run + best reign persist).
- **Mid-draft pick-level resume** — see §7 [PM call]: resuming a run parked mid-draft restarts the draft from the same seed (identical rolls), rather than restoring individual kept picks.

## 4. What persists, and when

**Single localStorage key:** `title-run:v1`. One JSON blob:

```
PersistedState = {
  version: number,          // SCHEMA_VERSION, currently 1
  run: RunState | null,     // the active run (null = no run / at landing)
  bestReign: number | null, // best defenses of PRIOR completed runs (null = never champion)
}
```

- **Autosave:** every time `run` or `bestReign` changes, the whole blob is rewritten. There is no manual save.
- **Hydrate:** on app mount, load the blob; render exactly the phase it describes.
- **`RunState` is already serializable** (M6 designed it so — plain data, no functions, JSON-round-trippable, including the settled `FightState` it carries in `reward`/`run-over`). M7 stores it verbatim; no new domain shape.

**[PM call] Why one blob under one versioned key:** simplest thing that satisfies "resume exactly." A single atomic write avoids partial-state bugs; a `version` field lets a future milestone migrate or invalidate cleanly. Rejected: separate keys per field (atomicity/consistency risk), IndexedDB (overkill for a few KB, async complexity for zero benefit).

## 5. Best reign & the end-of-run celebration

**`bestReign` = the best `defenses` reached by any run *strictly before the current one*.** It is meta-progress, not part of the pure per-run `RunState`.

- **Commit timing [PM call]:** `bestReign` folds in the just-finished run's reign **when the next run starts** (in "Start New Run"), not at the moment of death. Rule: `bestReign = endedRun.isChampion ? max(bestReign ?? -∞, endedRun.defenses) : bestReign`.
  - *Why lazy commit:* it keeps the run-over screen's "new record?" decision a clean strict comparison (`defenses > bestReign`) that is **fully resumable** — reopening the app on the death screen re-derives the same celebration, because `bestReign` hasn't yet absorbed this run. Rejected: live-updating `bestReign` as defenses climb (makes "was this a record?" ambiguous on ties and non-resumable).
- **New-record test (drives the flourish):** a run-over is a record when `run.isChampion && (bestReign === null || run.defenses > bestReign)`. First belt ever (even with 0 defenses) counts as a record ("First title!"), because `bestReign` is `null`.
- **Celebration surface:** on the run-over Hub view, when it's a record, show a compact flourish — e.g. a `★ New best reign!` badge plus `Reign N defense(s)` — above the existing record/method summary and the "Start New Run" CTA. No new screen; additive to M6's run-over view. Keep it a static visual flourish (no sound/animation — PRD out-of-scope).
- **Always-visible best:** the Hub landing (no run) and run-over views show the stored best reign (e.g. `Best reign: 3 defenses`, or `No title yet`) so the player always sees the number to beat.

## 6. Robustness (persistence never crashes the app)

- **Corruption/staleness:** `load()` wraps `JSON.parse` in try/catch; if parsing fails, `version !== SCHEMA_VERSION`, or the `run` fails a minimal shape check (`phase` is one of the known `RunPhase` values, or `run` is `null`), it returns defaults `{ run: null, bestReign: null }` and best-effort clears the bad key. A tampered/old save degrades to a clean landing, never a white screen.
- **localStorage unavailable:** access is wrapped in try/catch (private-mode Safari and some test/embedded contexts throw on access). On failure, persistence degrades to **in-memory only** — the game still plays for the session, it just doesn't survive reload. No crash, no error surfaced to the player.
- **[PM call]** Validation is intentionally shallow (phase enum + JSON round-trip), not a full schema validator. The only writer of the blob is our own app at the current version; deep validation is YAGNI. The `version` gate is the real safety net.

## 7. Mid-draft resume [PM call]

M6 keeps the draft's internal `DraftState` inside `DraftScreen`, seeded by `run.seed`. If a player parks a run while `phase === 'drafting'`, M7 persists `run` (phase `drafting`, with its `seed`), and on resume re-enters `DraftScreen` with that same seed — so the **same rolls reappear** and the player re-makes their picks.

- **Decision:** accept draft-restart-from-seed on resume; do **not** persist individual kept picks for v1.
- **Why:** the park/resume promise exists to protect a *run* (30–90 min of climbing, rewards, a title reign) from being lost. The draft is a ~1-minute, 9-pick prelude, and the run seed guarantees the identical fighters reappear, so nothing is randomly lost — at most a few picks are redone. Persisting mid-draft picks would require lifting `DraftState` out of `DraftScreen` into the controller/persistence layer, touching merged M6 UI for marginal value. **YAGNI.**
- **Seam preserved:** because the draft is seed-deterministic and `DraftState` is itself serializable (M3 design), a future milestone can make it pick-level resumable without rework. Documented as a known, deferred limitation.

## 8. Screens & wiring

- **`App` (controller):** gains three responsibilities, all additive to M6:
  1. **Hydrate:** initialize `run` and `bestReign` from `runStorage.load()` (lazy `useState` initializer).
  2. **Autosave:** a `useEffect` on `[run, bestReign]` calls `runStorage.save({ run, bestReign })`.
  3. **Best-reign commit:** `handleStartRun` folds the just-ended run's reign into `bestReign` (per §5) before starting the new run. Separately, at render time the controller derives `isNewRecord = run?.phase === 'run-over' && isNewRecordFn(bestReign, run)` and passes `bestReign` + `isNewRecord` down to the Hub (the derivation reads the *un-committed* `bestReign`, so it stays a clean strict comparison and survives reload).
- **`ChampionshipHubScreen`:** additive optional props `bestReign?: number | null` and `isNewRecord?: boolean`. Landing view shows the best-reign line; run-over view shows the best-reign line and, when `isNewRecord`, the `★ New best reign!` flourish. No change to climb/title/champion views, no change to callbacks.
- **No change** to `DraftScreen`, `FightScreen`, `RewardScreen`, `TopAppBar`, or any `src/domain/**` file. M7 is persistence + one additive Hub flourish. (If a trivial prop-typing tweak is needed to thread `bestReign`, it stays additive and covered by tests.)

## 9. Determinism & the seed

Persistence introduces **no new randomness**. A resumed run continues from the exact stored `RunState`, and because every downstream draw (rounds `${seed}#f${n}#r${r}`, opponents `${seed}#opp${n}`, reward re-rolls `${seed}#reward${n}`) derives from the persisted `seed` + counters, a parked-and-resumed run plays out identically to one played in a single sitting. The end-to-end test asserts this by comparing a resumed run against the same seed played straight through.

## 10. Testing strategy (strict TDD)

- **`runStorage` unit tests (jsdom localStorage):**
  - round-trips `{ run, bestReign }` (save then load returns an equal blob);
  - `load()` on empty storage returns defaults `{ run: null, bestReign: null }`;
  - `load()` on malformed JSON returns defaults and clears the key;
  - `load()` on a wrong `version` returns defaults;
  - `load()` on an unknown `run.phase` returns defaults;
  - save/load degrade without throwing when localStorage access throws (mock it to throw).
- **Best-reign logic unit tests** (pure helper `commitReign(best, endedRun)` + `isNewRecord(best, run)`):
  - first belt with 0 defenses is a record vs `null`;
  - a 2-defense reign beats a stored best of 1;
  - a losing run that never won the belt is not a record and doesn't change best;
  - `commitReign` folds champion reigns and ignores non-champion endings.
- **App integration (RTL):**
  - on mount with a saved mid-run blob, App renders that exact phase (e.g. saved at `pre-fight` fight 3 → Hub shows "Fight 3");
  - after each transition, `localStorage` holds the updated run (assert the key contents);
  - unmount + remount (simulated reload) restores the exact screen and run-status;
  - run-over that beats the stored best shows the `★ New best reign!` flourish; "Start New Run" then commits the new best and clears the record flag.
- **End-to-end determinism lock:** a full seeded run through the real `App` (`makeSeed={() => 'run-42'}`) — landing → draft (keep suggested ×9 + name) → climb → belt at fight 5 → one defense path → loss → assert run-over summary; then remount and assert exact resume; assert best-reign celebration on the record.

## 11. Success criteria

- Close/reopen (reload) at any phase restores the exact run; a run in progress is never lost to a refresh.
- Best title reign persists across runs and is celebrated when beaten; the number-to-beat is always visible on the Hub.
- Corrupt, stale, or unavailable storage degrades gracefully — the app always renders and plays.
- All prior tests stay green; no `src/domain/**` change; no new runtime dependencies.
- The end-to-end test proves a parked-and-resumed run is byte-identical to the same seed played straight through.

## 12. Open items (deferred, non-blocking)

- Pick-level mid-draft resume (see §7) — a clean future add via the preserved `DraftState` seam.
- Multiple save slots / run history / share codes — not in v1.
- Richer end-of-run cinematics and sound — PRD out-of-scope for v1.
