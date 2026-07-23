# Feel-Gate v2 — M19-B Live Hybrid Arena

**Protocol version:** v2 (replaces the retired M18 signature gate)  
**Harness:** `?arena=demo` on the REAL `FightView` at normal speed.  
**Human-only ship criterion:** the orchestrator surfaces this to the user after CI and code review pass.

---

## Setup

```
npm run dev
# Open each URL in Chrome DevTools → Device Toolbar at the indicated size
```

| Scenario | URL | Viewport |
|---|---|---|
| A — Jones (photo head, different frame) | `/?arena=demo&who=jones` | 390×844 |
| B — Adesanya (photo head, close crop) | `/?arena=demo&who=adesanya` | 360×640 |
| C — Custom player (procedural head) | `/?arena=demo&who=custom` | 390×844 |

---

## Blind Classification Task (per clip)

For each of the clips below, the reviewer must answer independently before comparing to the answer key. Each question is YES/NO or a named choice.

### Clip 1 — Jab to the head
- **Q1** Who threw the punch? (player / opponent)
- **Q2** Was it a punch or a kick?
- **Q3** Did it land / miss / get blocked?
- **Q4** Target zone? (head / body / legs)
- **Q5** Did the recipient react visibly?

### Clip 2 — Leg kick
- **Q1** Who threw it?
- **Q2** Was it a punch or a kick?
- **Q3** Land / miss / block?
- **Q4** Target zone?
- **Q5** Distinguish from Clip 1: what makes it visually different from the jab?

### Clip 3 — Body kick
- Same Q1–Q5 as Clip 2.
- **Q6** Can you distinguish a body kick from a leg kick?

### Clip 4 — KO finish
- **Q1** Which fighter went down?
- **Q2** Did the loser stay down or get up?
- **Q3** Did the arena lock the controls until the animation settled?

### Clip 5 — Idle state between decisions
- **Q1** Are both fighters visible and idle-bobbing (calm but alive)?
- **Q2** Are the decision panels accessible?

---

## Ship Criteria

| Criterion | Pass threshold |
|---|---|
| All 5 clips: actor correctly identified | 5/5 |
| Punch vs kick distinguishable | 5/5 |
| Hit / miss / block recognizable | ≥4/5 |
| Target zone (head/body/legs) correct | ≥4/5 |
| KO loser stays down | 1/1 |
| Impact feel (flash + shake + hitstop) | ≥4/5 "yes, visible" |
| "Would I use this as store-page proof?" | YES |
| Photo heads sit correctly on bodies | ≥3 framings checked |
| Custom procedural-head player readable | YES |
| 360×640 decision panels reachable | YES |

**DO NOT SHIP** if any of the first 5 rows falls below threshold, or if the store-page question is NO.

---

## Evidence Template (fill in for PR body)

```
## Feel-Gate v2 Evidence

**Reviewer:** <name>
**Date:** <YYYY-MM-DD>
**Branch:** kelvinxxle-m19b-live-hybrid-arena

### Clip 1 — Jab
- Q1: <player/opponent>
- Q2: <punch/kick>
- Q3: <landed/missed/blocked>
- Q4: <head/body/legs>
- Q5: <yes/no>

### Clip 2 — Leg kick
[same]

### Clip 3 — Body kick
[same + Q6]

### Clip 4 — KO
- Q1: <player/opponent>
- Q2: <stayed down/got up>
- Q3: <locked/unlocked>

### Clip 5 — Idle
- Q1: <yes/no>
- Q2: <yes/no>

### Store-page question
<YES / NO>

### Screenshots / recordings
[attach or inline]
```

---

## Notes

- The feel-gate runs on the REAL `FightView` at production speed — NOT a mocked animation.
- The code-side gates (CI, tsc, build, RNG-parity, balance, imports, tokens, deps) are verified separately in the PR body and do not depend on the human reviewer.
- A future v3 gate will test the full 3-round arc after the ground engine and game-plan system are playable.
