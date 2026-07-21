# M17.1 — Fighter Portrait Glow-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline) — orchestrator-executed in a throwaway clone. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the real fighter photos crisp and mobile-light, and formalize a zero-code drop-in slot so the owner can swap in their own high-res images per fighter.

**Architecture:** Pure asset + presentation milestone. No engine/domain/persistence/balance change. (1) Optimize oversized JPEGs and upgrade the softest low-res ones with better freely-licensed Wikimedia images. (2) Add a per-fighter hero-framing override (`object-position`) so faces aren't cropped awkwardly. (3) Document the `public/fighters/{id}.jpg` drop-in convention. Also commit the approved epic design doc.

**Tech Stack:** React + TS strict + Tailwind + Vitest/RTL + Vite. Image optimization via macOS `sips` (no dependency). Images from Wikipedia/Wikimedia Commons (freely licensed).

## Global Constraints
- No new dependencies (runtime OR dev). `package.json` + `package-lock.json` byte-identical to `origin/main`.
- No `Math.random` in `src/` production code.
- TypeScript strict; `npx tsc --noEmit` clean; `npm run build` clean.
- Determinism unaffected (no engine touch); full `npx vitest run` green ×2.
- Images: freely-licensed (Wikimedia/Commons CC/public-domain) only. The agent MUST NOT source or commit copyrighted "official UFC"/promo photos. Every `public/fighters/*.jpg` ≤ **600 KB** after optimization.
- Every commit trailer EXACTLY:
  `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`
  `Copilot-Session: db024489-e373-4e67-b5db-40b9ff27484d`
- One PR into `main`. Do not merge until reviewed (gpt-5.6-sol + Copilot) — orchestrator self-merges under autopilot.

---

### Task 0: Commit epic design + this plan

**Files:**
- Create: `docs/superpowers/specs/2026-07-20-cinematic-fight-epic-design.md` (verbatim from session artifact)
- Create: `docs/superpowers/plans/2026-07-20-m17_1-portrait-glowup-plan.md` (this file, verbatim)

- [ ] **Step 1: Copy both docs into the repo** (byte-exact from session `files/`).
- [ ] **Step 2: Commit**
```bash
git add docs/superpowers/specs/2026-07-20-cinematic-fight-epic-design.md docs/superpowers/plans/2026-07-20-m17_1-portrait-glowup-plan.md
git commit -m "docs: cinematic-fight epic design + M17.1 portrait glow-up plan"
```

---

### Task 1: Per-fighter framing support in FighterImage

**Files:**
- Modify: `src/components/FighterImage.tsx`
- Test: `src/components/FighterImage.test.tsx`

**Interfaces:**
- Produces: `FighterImageProps` gains `objectPosition?: string` (default `'50% 20%'`), applied to the `<img>` inline `style` for BOTH `portrait` and `hero` variants; the hardcoded `object-top` class is removed.

- [ ] **Step 1: Write the failing test** — append to `FighterImage.test.tsx`:
```tsx
it('applies a default face-biased object-position, overridable via prop', () => {
  const { rerender } = render(
    <FighterImage fighterId="jon-jones" name="Jon Jones" archetype="allrounder" variant="hero" />,
  );
  expect((screen.getByTestId('fighter-photo') as HTMLImageElement).style.objectPosition).toBe('50% 20%');
  rerender(
    <FighterImage fighterId="jon-jones" name="Jon Jones" archetype="allrounder" variant="hero" objectPosition="50% 8%" />,
  );
  expect((screen.getByTestId('fighter-photo') as HTMLImageElement).style.objectPosition).toBe('50% 8%');
});
```
- [ ] **Step 2: Run — expect FAIL** (`objectPosition` empty): `npx vitest run src/components/FighterImage.test.tsx`
- [ ] **Step 3: Implement** — in `FighterImage.tsx`:
  - Add `objectPosition = '50% 20%'` to the destructured props + `objectPosition?: string` to `FighterImageProps`.
  - Hero `<img>`: change `className="absolute inset-0 h-full w-full object-cover object-top"` → `className="absolute inset-0 h-full w-full object-cover"` and add `style={{ objectPosition }}`.
  - Portrait `<img>`: change `style={{ width: size, height: size }}` → `style={{ width: size, height: size, objectPosition }}`.
- [ ] **Step 4: Run — expect PASS (5/5)**: `npx vitest run src/components/FighterImage.test.tsx`
- [ ] **Step 5: Commit**
```bash
git add src/components/FighterImage.tsx src/components/FighterImage.test.tsx
git commit -m "feat(M17.1): per-fighter object-position framing on FighterImage"
```

---

### Task 2: Hero framing map + wire RolledFighterCard

**Files:**
- Create: `src/components/heroFraming.ts`
- Create: `src/components/heroFraming.test.ts`
- Modify: `src/components/RolledFighterCard.tsx`

**Interfaces:**
- Produces: `heroFraming(fighterId: string): string` — returns a per-fighter `object-position`, or `'50% 20%'` default when unmapped. Backed by `HERO_FRAMING: Record<string, string>`.
- Consumes: `FighterImage` `objectPosition` prop (Task 1).

- [ ] **Step 1: Write the failing test** `heroFraming.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { heroFraming, HERO_FRAMING } from './heroFraming';

describe('heroFraming', () => {
  it('returns the default face-bias for an unmapped fighter', () => {
    expect(heroFraming('definitely-not-mapped')).toBe('50% 20%');
  });
  it('returns the mapped value for a framed fighter', () => {
    const [id, pos] = Object.entries(HERO_FRAMING)[0];
    expect(heroFraming(id)).toBe(pos);
  });
});
```
- [ ] **Step 2: Run — expect FAIL** (module missing): `npx vitest run src/components/heroFraming.test.ts`
- [ ] **Step 3: Implement** `heroFraming.ts` (values populated during asset prep from actual viewing; at least one real override so the test has data):
```ts
// Per-fighter hero crop overrides (object-position). Default frames the face.
// Add an entry only when the default crops a fighter's face poorly on the hero card.
export const HERO_FRAMING: Record<string, string> = {
  'mark-hunt': '50% 25%',
};

export function heroFraming(fighterId: string): string {
  return HERO_FRAMING[fighterId] ?? '50% 20%';
}
```
- [ ] **Step 4: Wire RolledFighterCard** — import `heroFraming`; on the hero `<FighterImage ... variant="hero" />` add `objectPosition={heroFraming(fighter.id)}`.
- [ ] **Step 5: Run — expect PASS**: `npx vitest run src/components/heroFraming.test.ts src/components/RolledFighterCard.test.tsx`
- [ ] **Step 6: Commit**
```bash
git add src/components/heroFraming.ts src/components/heroFraming.test.ts src/components/RolledFighterCard.tsx
git commit -m "feat(M17.1): per-fighter hero framing map wired to draft card"
```

---

### Task 3: Optimize + curate assets; lock a size cap

**Files:**
- Modify (binary, orchestrator-staged): `public/fighters/*.jpg` (optimize the 6 oversized; upgrade the softest low-res where a clearly-better verified free image exists)
- Modify: `public/fighters/CREDITS.md` (regenerate; keep every source URL)
- Modify: `src/assets/fighter-images.test.ts` (add size-cap guard)
- Modify (if a source URL changed): `scripts/fighter-image-manifest.json`

**Asset prep (orchestrator, before committing):**
- Optimize each >600 KB file: `sips -Z 1000 -s formatOptions 82 <file>` (verified: aldo 2.26 MB → ~188 KB; targets: henry-cejudo, jose-aldo, max-holloway, charles-oliveira, conor-mcgregor, francis-ngannou).
- For the softest (<52 KB) — ronaldo-souza, brian-ortega, frank-mir, mark-hunt, cain-velasquez, bj-penn, chael-sonnen — fetch a higher-res **freely-licensed** Commons lead image, **view it to confirm it is the correct person** (petr-yan=Putin lesson), then `sips -Z 1000 -s formatOptions 82`. If no clearly-better verified free image exists, keep the current file and note it.
- Re-view a spot-check set after optimization to confirm no visible quality regression.

- [ ] **Step 1: Write the failing size-cap test** — add to `src/assets/fighter-images.test.ts`:
```ts
  it('keeps every shipped photo mobile-light (<= 600 KB)', () => {
    for (const f of STARTER_ROSTER) {
      if (NO_IMAGE.has(f.id)) continue;
      const p = `public/fighters/${f.id}.jpg`;
      if (!fs.existsSync(p)) continue;
      expect(fs.statSync(p).size).toBeLessThanOrEqual(600 * 1024);
    }
  });
```
- [ ] **Step 2: Run — expect FAIL** (oversized files present): `npx vitest run src/assets/fighter-images.test.ts`
- [ ] **Step 3: Stage optimized/curated `public/fighters/*.jpg`** (all ≤ 600 KB) + regenerate `CREDITS.md`.
- [ ] **Step 4: Run — expect PASS** (all present, all ≤ 600 KB, CREDITS present): `npx vitest run src/assets/fighter-images.test.ts`
- [ ] **Step 5: Commit**
```bash
git add public/fighters src/assets/fighter-images.test.ts scripts/fighter-image-manifest.json
git commit -m "perf(M17.1): optimize + curate fighter photos; lock <=600KB size cap"
```

---

### Task 4: Drop-in convention doc + full gate + PR

**Files:**
- Create: `public/fighters/README.md`

- [ ] **Step 1: Write `public/fighters/README.md`** documenting the drop-in slot:
  - Drop `public/fighters/{fighterId}.jpg` (ids listed in `scripts/fighter-image-manifest.json`) to override any portrait — no code change.
  - Recommended: portrait-oriented, ~1000 px on the long edge, ≤ 600 KB (matches the enforced cap).
  - Missing/broken image → automatic procedural `FighterAvatar` fallback.
  - Adjust a fighter's hero crop via `HERO_FRAMING` in `src/components/heroFraming.ts` (`object-position`).
  - Only commit images you have the right to use.
- [ ] **Step 2: Full gate**
```bash
npx vitest run            # green ×2
npx tsc --noEmit          # clean
npm run build             # clean
grep -rn "Math.random" src/ | grep -v ".test." | grep -v "//"   # expect 0
git diff --stat origin/main -- package.json package-lock.json   # expect empty
```
- [ ] **Step 3: Commit + push + open PR**
```bash
git add public/fighters/README.md
git commit -m "docs(M17.1): document fighter portrait drop-in slots"
git push -u origin <branch>
gh pr create --title "M17.1: fighter portrait glow-up" --body "<summary>" --base main
```

---

## Self-Review
- **Spec coverage:** epic §3.4 (glow-up = curate best free-licensed + optimize + high-res drop-in slots) → T3 (optimize+curate) + T4 (drop-in doc) + T1/T2 (framing). Keep photos (not retire) ✓. No copyrighted sourcing ✓ (Global Constraints). Roster/engine untouched ✓.
- **Placeholder scan:** none — `HERO_FRAMING` ships with a real entry; all tests are concrete; asset values are produced during prep, not left as code placeholders.
- **Type consistency:** `objectPosition?: string` (Task 1) consumed by `heroFraming(): string` (Task 2) and passed in RolledFighterCard. `HERO_FRAMING` + `heroFraming` names consistent. Coverage test reuses `STARTER_ROSTER` + `NO_IMAGE` already in the file.
