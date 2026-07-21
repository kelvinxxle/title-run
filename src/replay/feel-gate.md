# M18 Cinematic Fight Replay — Blind Feel-Gate Protocol

## Purpose

Validate that the cinematic replay pipeline delivers a FELT difference — specifically
that Conor McGregor's counter left straight (`the-left-hand`) reads as unmistakably
distinct from a normal cross, and that the overall replay conveys hit/miss/block/rocked
information accurately without the tester reading any labels.

## How to Run

1. Open `?lab=1` in the deployed app (or local dev server)
2. The Replay Lab shows a fixed-seed clip sequence containing normal strikes, a KO cross,
   and the McGregor signature
3. For each clip, **before reading any JSON summary**, record:
   - **(a) Outcome guess:** hit / miss / block / counter
   - **(b) Target:** head or body
   - **(c) Rocked/dropped?** yes or no
   - **(d) Signature flag:** "this felt different from a normal cross" yes or no
4. Advance to the next beat, then reveal the `ResolvedBeat` JSON summary shown below the animation
5. Fill in the "Actual" column from the JSON
6. At the end, answer the **subjective questions**

## Ship Criteria (ALL must pass)

- ✅ Classification correct on ≥ 4/5 clips (outcome + rocked/dropped)
- ✅ The McGregor counter-left is flagged as "different" (tester answers yes to question d)
- ✅ Subjective impact ≥ 4 / 5
- ✅ "Would I screenshot/record this as store-page proof?" → YES

## Results Table

_(Filled in live by product owner during feel-gate session.)_

| Beat # | Clip description       | Guessed outcome | Actual outcome | Rocked guess | Actual rocked | ✓/✗ | Impact 1–5 | Different? |
|--------|------------------------|-----------------|----------------|--------------|---------------|-----|------------|------------|
| 1      |                        |                 |                |              |               |     |            |            |
| 2      |                        |                 |                |              |               |     |            |            |
| 3      |                        |                 |                |              |               |     |            |            |
| 4      |                        |                 |                |              |               |     |            |            |
| 5      |                        |                 |                |              |               |     |            |            |

**Correct:** ___ / 5  
**Signature identified as different:** YES / NO  
**Subjective impact (avg):** ___ / 5  
**Store-page screenshot worthy:** YES / NO  

## Subjective Questions

After completing the clip scrub:

1. On a scale of 1–5, how visually impactful was the McGregor counter-left compared to a normal cross?
2. Did the hitstop (pause on impact) make the punch feel heavier? YES / NO
3. Did the screen shake communicate a meaningful knockdown? YES / NO
4. Was the slip animation before the counter-left readable as "dodge, then punish"? YES / NO
5. Overall: "I would screenshot or record this replay as store-page proof of the game's combat feel" YES / NO

## Reference: McGregor Counter-Left Timeline (for human review)

The `buildBeatTimeline` for `signatureId === 'the-left-hand'` produces:

| Phase      | Offset (ms) | Duration (ms) | Description                               |
|------------|-------------|---------------|-------------------------------------------|
| windup     | 0           | 80            | Load weight back                          |
| slip       | 80          | 120           | Slip the opponent's lead hand             |
| strike     | 200         | 80            | Fire the left straight                    |
| impact     | 280         | 60            | Contact — big flash                       |
| flash      | 280         | 60            | Full-body bright overlay                  |
| hitstop    | 340         | 120           | Clock freeze (both rigs hold on impact)   |
| shake      | 340         | 120           | Screen shake starts during hitstop        |
| recover    | 460         | 320           | Opponent crumples, player resets          |
| **Total**  |             | **780 ms**    |                                           |

A normal landed cross (no signature) produces ~422 ms total with no slip phase and only 60 ms hitstop.
The signature is **~1.85× longer** with a pre-counter slip and **2× the hitstop duration** — this is the
rhythmic fingerprint the feel-gate is measuring.

## Gate Status

- Human feel-gate: **PENDING** (live validation by product owner required before merge)
- Automated gates: see PR body for full gate evidence

---

_Protocol written for M18 per plan `docs/superpowers/plans/2026-07-21-m18-replay-slice-plan.md` Task 9._
