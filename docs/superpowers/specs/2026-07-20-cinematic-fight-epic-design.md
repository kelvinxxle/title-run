# Cinematic Fight Epic (V3) — Design

**Date:** 2026-07-20
**Status:** Approved direction (pending spec review) — decomposed into milestones M17.1 → M23
**Author:** Orchestrator, synthesized from a two-agent design debate (Claude Opus 4.8 "creative director" ↔ GPT-5.6 Sol "red-team pragmatist"), 2 rounds, cross-examined.
**Supersedes feel-goals of:** the Immersive Fight Overhaul epic (M15/M16/M17), which shipped mechanically but did not deliver fight *feel*.

---

## 1. Why we're here (motivation)

M17 ("signature strike moves") passed every automated gate and still felt like nothing to the product owner. Root cause, confirmed against shipped code:

- **No mechanical distinctiveness.** Every signature (Predator Bomb, McGregor Left Hand, Jones Spinning Elbow) resolves through the *same* head-damage branch, differing only by a flavor string + three numbers (`atkMult`/`defMult`/`power`). The Predator Bomb is literally just bigger numbers than the Left Hand. Mechanically it *is* a power punch.
- **No visual/audio payoff.** The entire fight is text and cards. A "cool moment" arrives as a sentence in a report.
- **Thin data.** `RoundLogEntry` carries only intents/winner/dominance; `RoundReport` collapses everything to prose + 4 damage deltas. Even if we wanted to animate, the engine doesn't currently emit enough truth to drive it.

The product owner asked for "extremely realistic and beautiful graphics" and a bigger roster.

## 2. The reframe (the pivotal decision)

Photoreal animated fighters are **not buildable** in this project — not because of the browser, but because:
- There is no artist / mocap / 3D-character pipeline. AI coding agents produce *code*, not rigged realistic characters and paired contact animation.
- Bespoke realistic per-fighter art scales *linearly* with roster size — it directly sabotages the "bigger roster" goal.
- Real-fighter *likenesses* animated in combat are an IP escalation.

But the realism a player *feels* in a great fight game comes from **animation, impact, timing, camera, and sound** — not polygons. That layer is fully agent-buildable, IP-clean, and scales to an unlimited roster.

**Decision: trade "photoreal" for "cinematic" — a stylized 2.5D fighter with EA-UFC-grade juice.** This is the honest ceiling and the whole epic hinges on it.

## 3. Decisions locked with the product owner

1. **Direction:** cinematic-stylized 2.5D + juice. Not photoreal. ✅
2. **Real photos stay.** Do NOT retire them. They remain on the roll/roster screens. (This overrides the agents' IP-hygiene recommendation; owner's explicit call on a personal project.)
3. **No copyrighted images sourced by the agent.** The current Wikimedia photos are freely licensed and safe. The agent will NOT source/commit copyrighted "official UFC" images. Owner may drop in any images they personally choose.
4. **Portrait "glow-up" (M17.1):** curate the best *freely-licensed* photos to replace weak ones, optimize file sizes, and wire high-res portrait slots so owner-supplied images work. (Duotone/graphic-novel treatment considered and declined — owner wants crisp real photos.)
5. **The fight animates with stylized procedural fighters, not photos** (a static photo can't throw a spinning elbow). Photos and animated fighters coexist: photos on roll/roster, procedural fighters in the fight.
6. **Roster grows.** Currently 40 fighters; procedural fighter rendering makes new additions ~free.
7. **A human feel-gate is mandatory** for every fight-feel milestone. Green tests are necessary but never sufficient again.

## 4. North-star vision (what the player sees & hears)

**The stage.** A single side-on octagon view: canvas floor in perspective, implied cage, moody key light. Two full-body stylized fighters, breathing on an idle loop, guard up, weight shifting. The health/stamina cards remain — now as a HUD *over* a live fight.

**A normal beat.** The player picks intent → the fighters *act it out*. A jab snaps with a motion streak and a leather "pop"; a slip rolls the head off-line; a body kick thuds with a low bass hit and a red flash where it landed. The winner gains forward momentum; the loser's head snaps back proportional to `dominance`. **Rocked** → wobble + vignette + ringing tone. **Gassed** → heavy shoulders, dropped hands. Every visual maps to a fact the sim already computed. Ordinary beat ≈ 0.7–1.1s.

**The signature moment (the M17 fix).** On detonation: a ~0.3s **hit-stop freeze** at contact, camera **punch-in**, desaturate-to-spotlight, sweat/spit particle burst, screen shake, bass-drop + a signature-specific SFX sting, the move's **unique animation** (the spinning elbow actually spins; the Predator Bomb is a telegraphed windup → single catastrophic frame), the flavor line slammed on as kinetic type, then slow-mo crumple. Mechanic and visual are authored *together* so the signature reads as unmistakably special. Signature beat ≈ 1.8–2.5s.

## 5. Architecture (how visuals hang off a deterministic sim without breaking it)

Inviolable rule: **the sim never changes shape and never sees the renderer.** Presentation is a downstream, pure projection.

```
[ deterministic sim ]              [ pure projection ]              [ render runtime ]
FightState + ResolvedBeat[]   →    buildBeatTimeline(beats, seed) → <FightReplay/>
(authoritative, seeded, tested)    (pure fn, unit-tested)           (SVG/rAF, reduced-motion path)
```

### 5.1 The `ResolvedBeat` contract (NEW — emitted by the engine)
The current log is too thin; presentation must not guess causality. The engine emits, as a byproduct of the *existing* resolution (no new RNG, no second code path), an ordered `ResolvedBeat[]` — per exchange:

- stable beat id + sequence index; round + exchange
- `actorId`, `targetId`
- `moveClass` (`advance | strike | evade | counter | impact | knockdown | signature`) + optional `signatureId`
- `outcome` (`landed | missed | blocked | evaded | countered`)
- `target` zone (`head | body | leg`)
- typed deltas (health / stamina / body / head / charge)
- `statusTransitions` (rocked, gassed, knockdown, finish-window, finished)
- `isFinish`

It carries **no** animation timing, camera, SFX, or particle data — that is presentation's job. This becomes a **tested public surface** of the engine: golden `seed → ResolvedBeat[]` snapshot tests.

### 5.2 The projection (pure, in presentation)
`buildBeatTimeline(beats, presentationSeed) → BeatEvent[]` adds timing, camera, VFX, and audio cues. It *styles* semantics; it never *infers* outcomes. Pure ⇒ trivially unit-testable. Any cosmetic randomness uses a presentation seed `hash(fightSeed, beatId)` and is **never** fed back into the sim. `Math.random` stays banned.

**Split of responsibility: the sim owns meaning; the projection owns motion.**

### 5.3 Boundaries & tests
- New `src/replay/` (projection + render runtime) and a `<FightReplay/>` that slots into `FightView` above the HUD. One-way imports only: `replay → domain`, never the reverse. `domain/combat/` gains only the `ResolvedBeat[]` emission.
- Determinism of the *fight* is untouched (visuals are read-only projection).
- Tests: sim tests unchanged (the guarantee) + new golden `ResolvedBeat[]` snapshots; pure-projection timeline fixtures; light RTL smoke on the runtime; a **reduced-motion / instant-result path** that renders the final state immediately (keeps existing `FightView` tests green + a11y). No pixel-diffing.

### 5.4 Rendering tech
**SVG-first.** Extend the existing procedural SVG `FighterAvatar` into full-body puppets animated via SVG + `requestAnimationFrame`/CSS. **PixiJS/WebGL is deferred** to M19+ and adopted only if SVG hits a measured perf wall. **AI-baked background art is deferred** (a simple procedural/gradient stage suffices early). Audio is **procedural** (WebAudio) and/or explicitly licensed SFX packs — no runtime AI, static-deployable, offline-capable.

## 6. Fighter representation that scales (roster growth ≈ free)

No per-fighter art. Appearance is a deterministic function of `(archetypeId, fighterId-seed, stats)`:
- **~5 archetype body rigs** (striker lean/tall, brawler heavy/wide, wrestler dense/low, grappler rangy, allrounder balanced).
- **Seeded palette/gear modules** from `fighterId` (skin, trunks, gloves, procedural tattoo shapes — not likenesses, hair/headgear, wraps) — extends the existing `FighterAvatar` seeded `pick()`.
- **Stance encodes stats** (high fightIQ → tighter guard; low strikingDef → hands-down) → glanceable legibility, not just cosmetics.
- The **player's composite** draws palette/gear from the fighters they rolled (a visual mashup) — on-theme for a fighter-*builder*.

Adding a roster member = a data row. Zero new art. Real photos remain the roll/roster identity; procedural rigs are the *fight* identity.

## 7. Distinct signature mechanics (the real M17 fix)

Distinctiveness lives in **mechanics + bespoke visual**, never in `atkMult/power`. Implemented as **composable pure reducers / state-machines** emitting typed events (triggers × sequences × risks × targets × payoffs) — NOT one engine branch per fighter. Curate **6–10 marquee families + 5 archetype fallbacks**; roster additions map onto existing families. All deterministic, all fixture-testable. Examples:

- **Counter-Interrupt (Adesanya "Last Stylebender"):** only detonates when the opponent's beat is aggressive; converts their offense into your finish-window; whiffs if they play safe. (Reads opponent intent.)
- **Hail-Mary (Ngannou "Predator Bomb"):** all-in, legal even while rocked/losing; success = massive single impact + finish opportunity; failure = amplified counter / takedown transition. The comeback button.
- **Momentum-Theft (McGregor "The Left Hand"):** reactive counter-trap; on land, zeroes the opponent's `signatureCharge` and grants a free finish step; weak against jabs/takedowns.
- **Two-Stage (Jones "Spinning Elbow"):** exposed spin/setup → automatic elbow only if setup control succeeds; win = stagger next beat; lose = you're exposed. Naturally different cadence.
- **Phase-Break (wrestler):** bypasses the takedown-defense roll, forcing a dominant `ground` phase — changes phase, not a number.
- **Investment-Payoff (Holloway "Volume Finisher"):** power scales with accumulated opponent body damage + stamina drain — rewards a whole-fight strategy.

Each ships with a unique telegraph + detonation animation so the mechanic is legible on screen.

## 8. The feel-gate (solo-runnable; blocks "green but flat")

Automated tests validate determinism, transitions, a11y, and skipping — never *satisfaction*. Every fight-feel milestone additionally requires a one-person, evidence-producing gate the product owner runs against AI-recorded fixed-seed clips:

1. **Blind read:** watch the seed clips *before* the recap; write down hit/miss/counter + target per beat. Pass = correct classification **without** the recap. (If you can't read it, it failed.)
2. **Fatigue ID:** identify the gassed fighter in a matched pair.
3. **Signature recognition:** the signature clip is identifiable as "something special happened" on first watch, and its name pickable from 3 choices.
4. **Hands-on:** the owner plays the Replay Lab / fight directly.
5. **Ship bar:** every categorical answer correct, impact ≥ 4/5, and the owner answers **yes** to *"Would I use this clip as store-page proof of the combat feel?"*
6. **Artifact:** the clips (or GIFs) + the filled blind-read sheet are committed into the milestone PR as sign-off evidence. The AI implementer is **not** the judge.

## 9. Roadmap (decomposed; plan each milestone as we reach it)

| Milestone | Scope | Effort vs M17 |
|---|---|---|
| **M17.1 — Portrait glow-up** | Curate best freely-licensed fighter photos (replace weak/tiny ones), optimize file sizes (Cejudo/Aldo/Holloway ~2MB each), wire high-res portrait slots + better framing for owner drop-ins. Keep `CREDITS.md` attribution. No engine/fight changes. | ~0.3× |
| **M18 — Replay vertical slice** | THE risk milestone. Emit the `ResolvedBeat[]` contract (TDD) + pure `buildBeatTimeline` projection + `<FightReplay/>` on the existing SVG rig; two upgraded full-body puppets; **one** standing-strike family with hit/miss/counter/fatigued variants; **one** Counter-Interrupt signature (spinning elbow) end-to-end; full juice (hit-stop, camera punch, shake, particles, kinetic type, crumple); procedural audio (muted/autoplay-safe); a small fixed-seed Replay Lab (≈3 scenarios: clean round w/ counter, signature fire, KO); reduced-motion/instant path; the feel-gate. | **~3–4×** |
| **M19 — Full standing vocabulary** | All standing strike/evade/clinch beats + continuous whole-round playback; harden the Replay Lab (golden scenarios), tap-to-skip / 2×; simple arena + core impact/crowd SFX; revisit PixiJS only if SVG perf demands. | TBD |
| **M20 — Signature families** | 6–10 marquee signature reducers + 5 archetype fallbacks, each with bespoke telegraph/detonation. Full antidote to M17. | TBD |
| **M21 — Modular rig & roster representation** | Formalize 5 archetype rigs + palette/gear/tattoo/stance modules scaling to all fighters; player-composite visual mashup; nicer roster-card puppets. | TBD |
| **M22 — Roster breadth + audio pass** | Bigger roster (data rows, now visually free) + crowd reactivity tied to `dominance` + audio polish + entrances-lite. | TBD |
| **M23 — Ground game visuals** | Takedown/clinch/submission animation + grappling signature families; bring the `ground` phase up to the stand-up bar. | TBD |

M19–M23 are intentionally **not** fully specified here; each gets its own spec → plan → build cycle informed by the prior milestone.

## 10. Non-goals / explicit deferrals
Photoreal fighters; 3D as primary (Three.js); animated real-fighter likenesses; agent-sourced copyrighted images; runtime AI generation; runtime combat physics; blood/cloth/hair simulation; per-fighter bespoke art; pixel-diff testing.

## 11. Key risks
- **M18 is the make-or-break.** If the *ordinary* exchange doesn't read clearly and avoid fatigue, the epic is in trouble — hence the vertical slice + feel-gate front-load the risk.
- **Effort honesty.** M18 ≈ 3–4× M17; the epic is a multi-milestone commitment, not a single milestone.
- **Feel is human-judged.** Mitigated by the mandatory owner-run feel-gate with committed evidence.
- **Determinism regressions** from the new emission — mitigated by keeping emission a byproduct of existing resolution + golden snapshot tests + one-way import boundary.
