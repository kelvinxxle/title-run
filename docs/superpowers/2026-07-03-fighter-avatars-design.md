# Fighter Avatars — Design (M11)

**Status:** design / self-approved on autopilot. User veto window open before build.

**Milestone:** M11 (fighter avatars). Follows M9 (roster→40) and M10 (combat depth).

## 1. Problem / Why

The roster is 40 fighters with no visual identity — every card is text. User: "some pictures of the fighters might be cool." A portrait per fighter makes the roll/draft/hub/fight screens feel like a real fighting game and helps players tell fighters apart.

## 2. Hard constraint (non-negotiable)

**No real fighter photos.** Real UFC fighters carry copyright (photos) AND likeness/publicity rights. We will NOT source, embed, or hotlink real images, and won't render recognizable real-person likenesses. Avatars are **original, generated, stylized** graphics only. (If the user later wants real photos, that's a licensing decision they must resolve out-of-band; noted, not implemented.)

## 3. Goal

Every fighter gets a distinct, on-theme, copyright-safe portrait that is **deterministic** (same fighter → same face, fitting the seeded/no-`Math.random` ethos), **offline** (no network, no heavy deps), and cheap to render at multiple sizes.

## 4. Approach (locked: A)

**A — Procedural SVG "fighter bust," deterministic per fighter, archetype-tinted (recommended).**
A small pure hash of the fighter `id` seeds a set of visual features; the `archetype` sets the palette/accent. Rendered by a pure React component:

```ts
function FighterAvatar(props: { fighterId: string; archetype: ArchetypeId; name: string; size?: number }): JSX.Element
```

- **Hash → features** (deterministic, no `Math.random`; use a tiny string hash of `id`, or `createRng(id)`): skin tone (from a fixed on-theme palette), hairstyle/headgear variant, trunks/glove color, jaw/brow variant — a handful of discrete choices combined so 40 ids read as 40 distinct fighters.
- **Archetype → identity:** accent ring + color (striker red, wrestler blue, grappler purple, allrounder green, brawler orange) and a subtle stance cue, so archetype is legible at a glance.
- **Style:** flat, bold, geometric head-and-gloves-up bust drawn in inline SVG paths (a stylized fighter, not a plain identicon; not a real person). Scales crisply from a 40px card thumbnail to a 96px hub hero.
- **A11y:** `role="img"` + `aria-label={`${name} portrait`}`.

**Rejected alternatives:**
- **B — Five static archetype portraits** (one per archetype). Simplest, but all 9 strikers share one face — fails "tell fighters apart." Rejected.
- **C — Third-party avatar lib (DiceBear) / emoji.** Adds a dependency or network dependence and looks off-theme for a fight game; conflicts with the client-only/offline constraint. Rejected.

## 5. Data / roster impact

No new required roster fields — the avatar derives from the existing `id` + `archetype`. (Optional, only if a specific fighter needs a tweak: an `avatarSeed?: string` override on `Fighter` — deferred unless needed; YAGNI.)

## 6. Surfaces (wiring)

Render `<FighterAvatar>` in: the rolled-fighter card (draft roll), draft slot cards, the Championship Hub (player's fighter, larger), and the FightView corners (player + opponent). Opponents are procedural (no roster id) → give the opponent avatar a stable seed from `${seed}#f${fightNumber}` + its archetype so it's deterministic per fight. Keep existing layout; avatars slot into current card headers.

## 7. Out of scope (YAGNI)

Animation, entrances, expression changes on damage (that's the deferred juice/feel pass), user-uploaded images, real photos, per-fighter hand-authored art, a portrait editor.

## 8. Testing (strict TDD)

Pure component + generator: same `id` → identical SVG structure (deterministic); different `id`s → different feature selection (hash spread across the 40 real ids — assert a minimum distinct-output count); each `archetype` → expected accent color; renders at a given `size`; `aria-label` includes the fighter name; no `Math.random`. Light render tests that each surface shows an avatar for the shown fighter.

## 9. Definition of Done

`npx vitest run` green (count up), `tsc` clean, `vite build` ok, no new deps, no `Math.random`, TS strict/no-`any`. 40 distinct deterministic avatars visible across roll/draft/hub/fight in the live app. One PR into `main`, CI green, not merged (orchestrator reviews→merges→deploys).
