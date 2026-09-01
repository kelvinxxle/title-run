# Feel-Gate v3 — M19-C Per-Strike Choreography

**Protocol version:** v3 (extends [feel-gate-v2.md](feel-gate-v2.md), which stays the M19-B arena gate)
**Harness:** `?arena=demo` on the REAL `FightView` at normal speed.
**Human-only ship criterion:** the orchestrator surfaces this to the user after CI and code review pass.

## What changed since v2

v2 only asked "punch or kick?". The user's v2 feedback was:

> *"some things share an animation. Like a leg kick is the same as a knee and a jab is the same
> animation as a power punch."*

v2 could not have caught that — its questions were answerable with two animations. **v3 raises the
bar to naming the specific move.** The core fantasy is that the player drafted attributes from real
fighters and then chooses a tactic each round; if the choice has no visual consequence, the fantasy
does not land.

Two further gaps were found by independent review of the M19-C build and fixed in the same change:

- **The finishing blow was the generic fallback.** `finishStep` resolves a `commit` decision, not a
  palette strike, so the KO beat legitimately carries `moveId: null` — which dropped the single
  most-watched beat in the game onto the anonymous punch animation. It now has its own read.
  (Part 1b below.)
- **The whole-rig offsets teleported.** `rigX` (step in/out) and `bodyY` (drop/rise) were plain SVG
  transform attributes, so they snapped in one frame while every limb eased over 150ms. M19-C
  widened their range ~4× (`rigX` span 6px → 36px), turning an invisible seam into a visible jump.
  They now ride the same WAAPI path as the joints. (**D7** below.)

---

## Setup

```
npm run dev
# Open in Chrome DevTools → Device Toolbar at the indicated size
```

| Scenario | URL | Viewport |
|---|---|---|
| A — Jones (photo head, different frame) | `/?arena=demo&who=jones` | 390×844 |
| B — Adesanya (photo head, close crop) | `/?arena=demo&who=adesanya` | 360×640 |
| C — Custom player (procedural head) | `/?arena=demo&who=custom` | 390×844 |

Capture in scenario A unless a clip says otherwise.

---

## Part 1 — Per-strike blind classification (the v3 gate)

**Capture protocol.** All six strikes are on the strike panel. For each one, throw it and record a
clip of the exchange. Then **shuffle the six clips and strip the filenames** before review — the
reviewer must not know which clip is which.

**Reviewer task.** For each clip, name the move from this closed list, without being told:

> `Jab` · `Power Punch` · `Body Kick` · `Leg Kick` · `Knee` · `Elbow`

Record the answer *before* revealing the key. One guess per clip; no replays before answering.

| Clip | Reviewer's answer | Actual | Correct? | Confidence (1–5) |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |

### Intended reads (answer key — reveal only after answering)

| Move | What the reviewer should be seeing | Beat length |
|---|---|---|
| **Jab** | Lead hand only, almost no coil, minimal torso rotation. Snaps out and back before you settle. | 370 ms |
| **Power Punch** | Rear hand. Long, obvious coil away from the target, then full torso rotation + lean, deep step in, freeze on landing. | 722 ms |
| **Elbow** | Closest range. Arm stays **bent** — a short horizontal arc, not an extension. Quick in, sharp bite. | 484 ms |
| **Leg Kick** | Rear leg chops **low**, torso counter-leans away from the swing. No freeze — a thud, not a stun. | 518 ms |
| **Body Kick** | Same round-kick shape but the leg travels **clearly higher**, shin whipped out, much bigger counter-lean, longer to arrive. | 657 ms |
| **Knee** | Clinch range, hands pull down, thigh drives **vertically** with the shin folded back — no outward leg extension at all. | 543 ms |

### Follow-up discrimination questions

Answer these after the six clips, with the clips available side by side.

- **D1** Jab vs Power Punch — which hand throws each? Is the difference in *commitment* obvious?
- **D2** Leg Kick vs Body Kick — is the height difference unambiguous, or do you have to guess?
- **D3** Knee vs Body Kick — does the knee read as vertical (no extension) rather than a high kick?
- **D4** Elbow vs Jab — does the elbow read as a short bent arc rather than a straight punch?
- **D5** Ignoring the pose entirely: does each move have its own *rhythm*? Can you tell the jab from
  the power punch with your eyes half-closed, purely from speed and weight?
- **D6** The finishing blow (clip F below) — does it read as *the* biggest punch in the fight, and
  is it clearly not just a recycled power punch?
- **D7** Watch the fighters' feet and hips through any strike. Does the step-in **glide**, or does
  the whole body jump sideways in a single frame? (Pre-fix, `rigX`/`bodyY` snapped while the limbs
  eased; worst case was a 22px teleport on `knee-contact → idle`.)

---

## Part 1b — the finishing blow

The KO beat is the most-watched beat in the game and it used to play the *generic* punch fallback,
because `finishStep` resolves a `commit` decision rather than one of the six palette strikes, so its
beat carries `moveId: null`. It now has its own choreography (deepest coil → fullest extension,
168ms windup — the longest telegraph in the game).

| Clip | Check | Pass? |
|---|---|---|
| F1 | Play a KO finish. Does the finishing blow look *distinct from all six strikes* — bigger coil, longer wind-up, heavier landing? | |
| F2 | Does it still flow into the knockdown + hold, with the loser staying down? | |
| F3 | Is it obviously **not** the same animation as a power punch? | |

---

## Part 2 — M19-B regression sweep (must stay passing)

These were signed off in v2. Re-verify that per-strike work did not break them.

| Clip | Check | Pass? |
|---|---|---|
| R1 — Takedown | Neutral level-change/clinch. **No punch or kick poses**, no white flash on a damageless take. | |
| R2 — Landed strike | Impact flash still fires on the recipient at the correct zone. | |
| R3 — Leg-zone hit | Recipient plays the leg reaction (checks/limps), not a body reaction. | |
| R4 — Signature | Still the biggest moment in the game: slip, then the longest freeze, and clearly longer than any of the six strikes. | |
| R5 — KO finish | Loser goes down and **stays** down; controls locked until the animation settles. | |
| R6 — Idle | Both fighters visible and idle-bobbing between decisions; panels reachable. | |
| R7 — Reduced motion | With `prefers-reduced-motion: reduce`, poses snap to their final state and nothing animates. | |

---

## Ship criteria

| Criterion | Pass threshold |
|---|---|
| **Blind naming of the six strikes** | **≥5/6 correct** |
| Jab vs Power Punch distinguishable (D1) | YES |
| Leg Kick vs Body Kick distinguishable (D2) | YES |
| Knee vs Body Kick distinguishable (D3) | YES |
| Elbow vs Jab distinguishable (D4) | YES |
| Each move has its own rhythm (D5) | YES |
| Mean confidence across the six clips | ≥3.5 |
| M19-B regression sweep R1–R7 | 7/7 |
| Actor (player/opponent) correctly identified | 6/6 |
| Hit / miss / block still recognizable | ≥5/6 |
| "Would I use this as store-page proof?" | YES |

**DO NOT SHIP** if blind naming is below 5/6, if any of D1–D4 is NO, if the regression sweep is not
7/7, or if the store-page question is NO.

If a specific pair fails, say which pair and what you expected to see — the fix is a geometry or
timing tune in `src/replay/rigPoses.ts` / `src/replay/timeline.ts`, not a rewrite.

---

## Evidence template (fill in for PR body)

```
## Feel-Gate v3 Evidence

**Reviewer:** <name>
**Date:** <YYYY-MM-DD>
**Branch:** <branch>
**Scenario:** A / B / C

### Part 1 — blind naming (answered before seeing the key)
| Clip | Answer | Actual | ✓/✗ | Confidence |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |
| 4 | | | | |
| 5 | | | | |
| 6 | | | | |
Score: <n>/6   Mean confidence: <n>

### Discrimination
- D1 jab vs power punch: <yes/no> — <note>
- D2 leg kick vs body kick: <yes/no> — <note>
- D3 knee vs body kick: <yes/no> — <note>
- D4 elbow vs jab: <yes/no> — <note>
- D5 rhythm alone: <yes/no> — <note>

### Part 2 — M19-B regression sweep
R1 takedown: <pass/fail>
R2 landed flash: <pass/fail>
R3 leg reaction: <pass/fail>
R4 signature biggest: <pass/fail>
R5 KO stays down: <pass/fail>
R6 idle: <pass/fail>
R7 reduced motion: <pass/fail>

### Store-page question
<YES / NO>

### Screenshots / recordings
[attach or inline]
```

---

## Notes

- The gate runs on the REAL `FightView` at production speed — NOT a mocked animation.
- Every strike duration is a constant in `STRIKE_CHOREOGRAPHY` (`src/replay/timeline.ts`); no
  presentation RNG feeds timing, so two captures of the same clip are byte-identical.
- Code-side gates (CI, tsc, build, RNG-parity, balance, imports, tokens, deps, reduced motion) are
  verified in the PR body and do not depend on the human reviewer.
- The rig's joint tween is a fixed 150 ms (`src/components/HybridRig.tsx`). That is intentional
  here: a 34 ms jab windup barely renders its coil while a 152 ms power-punch windup renders it in
  full, which *reinforces* the telegraph difference. If a reviewer reports popping on the fastest
  strikes, that tween is the place to look.
- Ground/grappling choreography is still deferred; takedown keeps the M19-B neutral level-change.
