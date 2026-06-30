# Title Run — UFC Fighter-Builder Roguelike (v1 Product Spec)

> Product spec only — **what** we're building and **why**. Implementation (**how**) is
> intentionally out of scope for this document.

## Summary

A single-player web game where UFC fans **draft a custom fighter from the best attributes
of real fighters**, then fight an endless, escalating run to win the belt and rack up the
**longest title reign**. Randomized rolls plus small round-by-round tactical decisions make
runs short, varied, and highly replayable.

## Why we're building it

Give fans the "what if I assembled a fighter from my favorite stars' best skills" fantasy in
a quick, low-commitment, high-replay format. Each run fits a focused sitting and can be
parked and resumed exactly where it left off.

## Player profile alignment (design grain)

Built to the user's Cognitive Interface Model:

- **Focused sittings + park/resume:** a run fits 30–90 min; autosave restores exact state.
- **Visual/spatial first:** fighters and stats shown as cards and bars, not prose.
- **Full info, sparse surface:** all stats visible, but one focus screen at a time.
- **Smart defaults, alternatives nearby:** suggested picks highlighted, easy to override.
- **Recoverability over prevention:** confirmations reserved for irreversible actions.
- **Specific, immediate feedback:** every action states what actually changed.

## Core loop

### 1. Draft (build your fighter)

- Your fighter has **9 stat slots**: Boxing, Kicks, Clinch, Takedowns, Submissions,
  Top Control, Cardio, Chin, Fight IQ.
- Each draft step: **roll a random real fighter** → see their full 9-stat line → **keep one
  stat into its matching empty slot** (e.g., Conor's Boxing → your Boxing).
- Repeat until all 9 slots are filled. Choices narrow as slots fill, so late picks carry
  real tension.
- **Draft pool spans all weight classes** — cherry-pick attributes from any real fighter.
  Weight class is **flavor only** (shown on the card), with no mechanical restriction.
- Name your fighter to finish the draft.

### 2. Fight (round-by-round decisions)

- An endless run of bouts against opponents that **scale in difficulty** each fight.
- Each round, pick **one tactical intent**: *Strike on the feet, Pressure & clinch,
  Shoot takedown, Hunt submission, Stay safe & out-point.*
- The sim resolves the round from **your stats vs. the opponent's**; **Fight IQ tilts the
  odds**. Win by KO/sub during the rounds, or by decision at the end.
- **Round format:**
  - Fights 1–4 (the climb): **3 rounds**.
  - Fight 5 (for the **vacant belt**): **5 rounds**.
  - Every fight after (title defenses): **5 rounds**.

### 3. Reward (between fights)

- After each win, pick **one** small reward: *bump a stat, re-roll a weak stat, or recover
  from damage.*
- The next opponent is tougher.

### 4. Streak & end state

- **Damage can carry between fights** (durability driven by Chin); the "recover" reward
  heals it.
- **A loss ends the run** (roguelike permadeath).
- **Headline score = successful title defenses (reign length).** Total wins is secondary.
- If a run beats the player's local best, it's celebrated.

## In scope (v1)

- Curated roster of **~30–40 real fighters across all weight classes**, with hand-tuned
  9-stat lines.
- Draft → Fight → Reward → endless streak, with permadeath.
- Title won at **fight 5**; 5-round title fights and defenses thereafter.
- **Local autosave**: park & resume to exact state; stored **best reign**.
- Visual, single-focus screens with specific "what changed" feedback on every action.

## Out of scope (v1, deferred)

- Accounts, online leaderboards, multiplayer.
- Per-exchange micro-decisions (decisions stay at round level).
- Career mode, contracts, or training beyond the single reward pick.
- Licensed imagery — text and simple avatars only (real names used as a fan project).
- Sound/music.

## Success criteria

- A fan can reach their **first title win in a single focused sitting**.
- Runs feel **varied** thanks to randomized rolls and reward choices.
- The player can **quit anytime and resume exactly** where they left off.

## Confirmed defaults

1. **Round structure:** 3 rounds for fights 1–4; 5 rounds for the title fight (fight 5) and
   all defenses.
2. **Permadeath:** the first loss ends the run.
3. **Real names** used as a fan project; no official photos or logos.

## Open items (deferred to implementation, not blocking scope)

- Exact difficulty-scaling curve for opponents.
- Exact stat-to-outcome math for round resolution.
- Final fighter list and stat tuning.
