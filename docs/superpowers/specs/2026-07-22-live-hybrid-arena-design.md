# M19 — Live Hybrid Arena (Design Spec)

**Status:** design locked, motion decided (Tweened), rig art user-approved via prototype. Awaiting spec approval → writing-plans.
**Supersedes the feel of:** M18 Cinematic Fight Replay (PR #23) — engine VERIFIED, renderer REJECTED.
**Reference artifact:** `files/2026-07-22-rig-slice-prototype.html` (the approved vertical slice; open at `/title-run/rig-slice.html`).

---

## 1. Why

M18 shipped a mechanically-correct, fully-tested fight replay driver, but its renderer (`FighterRig`) drew fighters as **rectangles and circles**. The human feel-gate FAILED: *"you can't even tell what's happening."* The engine is sound; the **art and staging** are the problem.

M19 makes a fight **legible and alive**: at a glance you can tell **who** is fighting (recognizable faces), **what** just happened (punch vs kick, landed vs blocked, where it hit), and it stays on screen as a **living arena** rather than a blink-and-miss replay. This is the milestone that turns "unsatisfying" into "worth watching."

---

## 2. What — locked scope (5 decisions)

1. **Hybrid rig art.** Each fighter = real fighter **photo clipped as the head** on a tinted, articulated **vector body** (torso / arms / legs / gloves). Corner-colored. Facing-aware. Replaces `FighterRig`. *(User-approved in prototype.)*
2. **Live-Round placement.** The arena **is the main standing fight view** — both fighters on screen the whole round, idle-bobbing, reacting to every decision. Decision panels sit underneath. Not an opt-in replay.
3. **Shared motion set.** ONE punch animation (all punches), ONE kick animation (all kicks), plus slip / block / hurt / knockdown. Per-fighter signature choreography (McGregor left, Jones elbow) = a LATER milestone.
4. **Ground deferred.** Standing gets the live arena. When `phase==='ground'`, the arena shows a simple "on the mat" state and the existing `GroundPanel` handles decisions. Full ground choreography = later.
5. **Motion = Tweened.** Interpolated cubic-bezier ease (NOT stepped snap-cut). *(User-decided 2026-07-22 after side-by-side stepped-vs-tweened prototype.)*

---

## 3. Non-goals / scope cuts

Explicitly OUT of M19 (do not build): a JS idle clock, animated crowd/cage, a DOM (non-SVG) rig rewrite, per-fighter signature choreography, full ground choreography, and a simultaneous clock+timeline engine refactor. Keep the verified M18 beat driver **unchanged in behavior**.

---

## 4. Approved art — the hybrid rig

Source of truth = the persisted prototype. Anatomy the user signed off on:

- **Head:** the fighter photo (`<image href>`) clipped to a circle (r≈30) with a dark backing disc and a soft white ring; sits in a `head` group at `translate(0,-130)`. Deliberately **larger** than a stick-figure head so the face reads on mobile (~face is the identity anchor).
- **Torso:** a tapered SVG path (shoulders→waist), dark charcoal tinted per corner (`#3a3138` red corner / `#33333d` else) — reads as a rashguard/bare torso, NOT a colored block.
- **Shorts = painted legs, NOT an overlay.** The **entire upper leg (thigh) is painted the trunk color** down to the knee (long MMA shorts); **shins are bare skin**; feet are dark. A small hip-yoke path at the pelvis ties the shorts together. This was the key fix — a floating shorts panel looked like a tutu; painting the leg geometry means the shorts always fit and move with the stance.
- **Gloves:** a **mitt shape** (fist + thumb + two knuckle lines), **unified to the fighter's corner color** — McGregor **red** `#e23b2e`, Khabib **blue** `#2f6fb0`. Not two-tone circles.
- **Corner tints (slice):** McGregor trunk `#c8321f` / skin `#d9a066`; Khabib trunk `#2f6f3a` / skin `#c98f5f`. Production maps these from fighter archetype/corner.

### Facing model (critical, non-obvious)
An **un-mirrored rig faces LEFT** (head leans right, punches left). So:
- **Player / left fighter = MIRRORED** (`translate(180,0) scale(-1,1)`) → faces right.
- **Opponent / right fighter = un-mirrored** → faces left.
- The head photo is **counter-mirrored** on the mirrored fighter (`scale(-1,1)` on the head group) so the face is never backwards while the body mirrors.
- `rigX` (lunge/recoil offset) is **facing-dependent**: on the mirrored fighter a positive `rigX` moves screen-LEFT. Poses account for this (attacker lunges toward opponent; defender recoils away).

### Joint model
Ten rotational joints, transform = **translate-to-base-then-rotate**, units are **px/deg** (unitless CSS silently no-ops):
`torso, head, armLead, foreLead, armRear, foreRear, thighLead, shinLead, thighRear, shinRear`
plus a `body` translateY (breathing/level) and a `rig` translateX (`rigX`). Legs are **articulated** (hip + knee) — this is new vs the M18 rig, which never moved the legs.

Approved poses in the slice: `GUARD`, `A_LOAD` (wind-up), `A_CONTACT` (strike extended + lunge), `T_HURT` (big recoil), `T_REEL` (smaller rocked). These are the seed values production poses derive from.

---

## 5. Motion — Tweened (LOCKED)

- Driver: WAAPI `element.animate` per joint, `fill:'forwards'`, easing **`cubic-bezier(.34,1.2,.4,1)`** (slight overshoot ease-out — snappy but not robotic). Body/rig offsets use `ease-out`.
- **Not stepped.** The stepped variant (snap-cut `steps(1,end)`) was rejected by the user in the side-by-side. Production ships the interpolated feel.
- Slice timeline beat order (guard → load → contact+FX → hurt → recover → guard): the attacker winds up, lunges to contact, the impact FX fire **as** the defender recoils, both settle back to guard. Contact and defender-reaction are **simultaneous** at the impact timestamp.
- Motion must honor `prefers-reduced-motion`: reduced = instant pose set / crossfade, no idle bob, playback resolves immediately.

---

## 6. Architecture

Reuse the **verified M18 beat/timeline/hitstop/VFX driver unchanged**; swap ONLY the art and add persistence + live staging.

- **`useBeatPlayback(beat, seed) → { poses, flashes, shakeX, isPlaying }`** — extract the verified rAF/hitstop loop out of `FightReplay` **VERBATIM** in a dedicated mechanical commit, guarded FIRST by a frame-trace **characterization test** (identical frame trace before/after). No behavior change.
- **`FightReplay`** → becomes a thin compatibility adapter over the hook (keeps ReplayLab + all existing M18 tests green).
- **`ArenaStage`** = **pure renderer**: background/cage, HUD overlay, mounts two `HybridRig`s, applies poses/flashes/shake from the hook. No playback state of its own.
- **`HybridRig`** = the art unit: articulated vector body + photo head + tint + `fighterId`; procedural-head fallback when no photo.
- **`FightView`** coordinates playback and **locks ALL phase controls while `isPlaying`** (see §9).

Do NOT combine hook-extraction + kick choreography + arena wiring in one change — three separable steps.

---

## 7. Move-family mapping (fixes a CONFIRMED bug)

Production `StrikeId = jab | powerPunch | bodyKick | legKick | knee | elbow`, but `timeline.ts` maps only `jab/cross/hook` (cross/hook aren't even production moves) → **every kick/knee/elbow currently renders as a punch.** Fix with an **exhaustive** family mapping:
- **Hands** (punch anim): `jab`, `powerPunch`, `elbow`.
- **Lower body** (kick anim): `bodyKick`, `legKick`, `knee`.
- **Takedown/ground:** explicit mat transition — NEVER fake a cross.
- **Signature:** shared family keyed by signature ID (for now).
- `legKick` must produce a **leg** flash + **leg-hurt** reaction, not a body reaction.
Mapping must be a total function over `StrikeId` (exhaustive `switch`, compile-time never-fallthrough).

---

## 8. Pose system additions

`src/replay/poses.ts` today has no leg joints. M19 adds:
- Leg joints (hip rotate, knee bend/extend) to `Pose`.
- New poses: `punch-load`, `punch-contact`, `kick-load`, `kick-contact`, `hit-leg`.
- The articulated-leg values are seeded from the approved slice poses.

---

## 9. Bug fixes carried in

- **Down/downed double-rotation:** `down` rotates torso ~80° AND `downed` rotates the rig ~80° = ~160°. Establish **one root transform owner** for knockdown; no compounding.
- **HUD timing:** today HP bars change **before** the punch lands. HUD must **hold displayed values at the previous state and commit at impact/completion**.
- **Non-finish settle:** on a non-finish playback end, `ArenaStage` forces **idle/guard** (ignore the timeline's diagnostic final pose, which leaves the target stuck in `hit-head`/`reel`). On a finish, the downed fighter **stays down**.
- **Control-locking:** disable ALL panels (strike/finish/corner/ground and any Continue) while `isPlaying`; a 2nd click cannot resolve another exchange mid-playback; reduced-motion unlocks immediately.

---

## 10. Visual-mode state machine

`ArenaStage` renders one of: **mat** (ground phase) | **active-playback** | **KO-down** | **standing-idle**. Transitions are driven by phase + `isPlaying` + beat finish, not by ad-hoc flags.

---

## 11. Idle animation

CSS keyframes on a **dedicated wrapper layer** (not the SVG pose/root transform), **paused during playback including hitstop**, **disabled under `prefers-reduced-motion`**. NO extra rAF, NO clock/`Date.now` API — RNG/DOM-determinism safe.

---

## 12. SVG determinism traps

- Deterministic **semantic clip ids** (`player`/`opponent`) or id-free clipping — avoid `useId()`/duplicate `clipPath` ids across two rigs.
- Photos are **portrait assets** → build a per-fighter **head focal-point/scale map** and eyeball all 38 fighters (crop review).
- **Counter-mirror ONLY facing** — the photo still rotates with torso/knockdown; same local head group.
- Extract a procedural head **fragment** (don't nest the whole `FighterAvatar`).
- **Memoize** each rig so per-frame shake doesn't reconcile both trees; HUD lives **outside** the shake layer.
- Photo `href` must be **base-prefixed** (`/title-run/`) and **fall back** on error/missing id.
- SVG stays (DOM limbs aren't faster and are harder to sync).

---

## 13. Custom player head

The player's custom fighter has **no canonical photo** → a **procedural head** is product-correct (picking a real photo would misrepresent the build). Make the asymmetry **intentional**: same crop/border/halo/scale/lighting as the photo heads. Include custom-vs-real in the feel-gate.

---

## 14. HUD info parity + responsive budget

Don't regress to just HP+stamina — keep **body-condition + head-state** (rocked/gassed). Compact **fixed HUD band**; fixed responsive **stage-height budget**; verify decision controls are reachable at **360×640 AND 390×844**.

---

## 15. De-risk process + feel-gate v2

- **Vertical slice FIRST (done):** one final-quality slice (idle → punch → contact → hurt) at 390px = `rig-slice.html`, already built and **art+motion approved**. This de-risks the full build.
- **Feel-gate v2:** drop the old McGregor-signature gate (tests a now-deferred feature). Test the **real FightView at NORMAL speed**; a blind reviewer must correctly ID: **actor**, **punch vs kick**, **hit / miss / block**, **target zone**, and **knockdown**. Include **mobile**, **3 differently-framed photos**, and the **custom-player fallback**.

---

## 16. RED→GREEN test priorities

1. Frame trace **identical** after hook extraction (characterization).
2. A 2nd decision is **blocked** during playback.
3. Idle class present **only** in settled standing mode; **no extra rAF**.
4. Ground phase **overrides** standing choreography.
5. **Every `StrikeId`** maps exhaustively (no fallthrough).
6. `legKick` → **leg** reaction/flash.
7. Non-finish settles **idle**; KO stays **down**.
8. Photo `href` base-prefixed + **fallback** on error/missing id.
9. Left-facing photo **counter-mirrored** while body mirrored.
10. Both rig DOM nodes **survive** rerenders (memoized).

---

## 17. PR #23 disposition

Do NOT merge #23 as-is (it wires stick-figures into the live `FightView`). Recommended: **split the verified HEADLESS core** (beat/timeline/hitstop/VFX driver + `useBeatPlayback`, no `FightView` mount, no public ReplayLab route) and **merge it dormant**; then land `ArenaStage`/`HybridRig` as the **first user-visible release**. Avoid another long-lived child branch stacked on top. Final call = user's.

---

## 18. Open risks

- Live fight **feel** is still not human-validated at full-scene scale — the entire point of this pivot. Feel-gate v2 on the real FightView is the ship gate.
- Photo crop quality across all 38 fighters is unproven at scale (focal-point map needed).
- Extraction of the verified driver must be provably behavior-identical, or M18's hard-won correctness regresses.
