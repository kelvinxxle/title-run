# Ship Title Run to GitHub Pages — Design Spec

**Date:** 2026-07-01
**Status:** Approved (design), ready for implementation plan
**Repo:** `kelvinxxle/title-run` (public), base branch `main` @ `b9c521775`

## 1. Goal & Why

Title Run v1 (M1–M7) is feature-complete and merged, but it is not deployed
anywhere. The user wants it **live at a public URL so it is playable on their
iPhone**, and wants future merges to `main` to redeploy automatically.

This is a **deployment + hosting** task, not a gameplay change. The game code is
frozen; the only source change is the Vite `base` path plus one small mobile
meta tag.

## 2. Scope

In scope:
1. Automated deploy to **GitHub Pages** via a **GitHub Actions** workflow on push
   to `main`.
2. **Vite `base` path** config so assets resolve under the project subpath.
3. One small iOS-Safari polish (`theme-color` meta) and verification that the
   existing responsive layout plays correctly at iPhone width.

Explicitly out of scope (see §7).

## 3. Hosting Decision

- **Host:** GitHub Pages (free for public repos, integrated, no third-party
  account).
- **URL:** `https://kelvinxxle.github.io/title-run/` (default project-page URL;
  no custom domain).
- **Deploy source:** "GitHub Actions" (not the legacy branch-based Pages). This
  builds from source on each push — no committed `dist/` and no `gh-pages`
  branch.

## 4. Deployment — GitHub Actions workflow

Add `.github/workflows/deploy.yml`:

- **Trigger:** `push` to `main`, plus `workflow_dispatch` (manual re-run).
- **Permissions:** `contents: read`, `pages: write`, `id-token: write`.
- **Concurrency:** group `pages`, `cancel-in-progress: false` (don't cancel an
  in-flight deploy).
- **build job** (ubuntu-latest):
  - `actions/checkout@v4`
  - `actions/setup-node@v4` with `node-version: 20`, `cache: npm`
  - `npm ci`
  - `npm run build` (runs `tsc -b && vite build` → emits `dist/`)
  - `actions/configure-pages@v5`
  - `actions/upload-pages-artifact@v3` with `path: dist`
- **deploy job** (needs: build):
  - `environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }`
  - `actions/deploy-pages@v4` (id: `deployment`)

Pin all official actions to their current major tags as above.

The existing `build-and-test` workflow is **left unchanged** — it stays the PR
gate; `deploy.yml` runs post-merge on `main`. (Deploy re-runs `npm run build`
independently, which is acceptable and keeps the two workflows decoupled.)

**Pages enablement:** enable Pages with `build_type = "workflow"` via the GitHub
API/CLI (orchestrator will do this: `gh api -X POST/PUT repos/kelvinxxle/title-run/pages`
with `build_type: workflow`, or the equivalent). This is a repo-settings action,
not a code change, so it is done by the orchestrator, not inside the PR.

## 5. Vite base path

In `vite.config.ts`, add:

```ts
base: '/title-run/',
```

- Rationale: a GitHub **project** page is served from `/<repo>/`, so built asset
  URLs (`/assets/*.js`, CSS, etc.) must be prefixed with `/title-run/` or they
  404. Vite rewrites asset references at build time when `base` is set.
- The app has **no client-side router** and no hardcoded absolute asset paths in
  code (fonts load from Google's CDN via absolute `https://` URLs in
  `index.html`, unaffected by `base`; the `#root` script is `/src/main.tsx`,
  which Vite rewrites). So `base` is the only path-sensitive change.
- Set it **unconditionally** (not mode-gated) for simplicity — local `vite dev`
  and `vite preview` then serve under `/title-run/`, which is fine and actually
  mirrors production. `vitest` ignores `base`, so tests are unaffected.

## 6. iPhone / mobile

Current state (verified read-only against `main`):
- `index.html` already has `<meta name="viewport" content="width=device-width, initial-scale=1.0" />`.
- Layout is fluid/responsive: `min-h-screen flex flex-col`, `w-full max-w-md/lg`
  centered columns, flexbox/grid, **no fixed pixel widths**, no absolute/fixed
  positioning, no `whitespace-nowrap` overflow risks.
- The single text input (`NameFighterForm`) has no `text-sm/xs` class, so it
  inherits the 16px base font → **no iOS focus-zoom**.

Therefore **no layout rework is needed.** Changes:
1. Add `<meta name="theme-color" content="#0e0e0e" />` to `index.html` so
   Safari's toolbar tints to match the dark theme. `#0e0e0e` is the app's
   `background` token (`src/theme/tokens.ts`), matching `bg-background` on the
   root container.
2. Verification only (no code): confirm the app renders and a full run is
   playable at a 390px-wide (iPhone) viewport — no horizontal scroll, tap
   targets usable.

Staying true to "just the URL for now": **no PWA manifest, no apple-touch-icon,
no standalone/home-screen meta tags.**

## 7. Out of Scope

- PWA / "Add to Home Screen" / standalone mode / offline support.
- App icons / manifest / apple-touch-icon.
- Custom domain (stick with `*.github.io/title-run/`).
- Any gameplay, domain, or UI-behavior change.
- Changing or merging the existing `build-and-test` workflow into deploy.
- Touching `src/domain/**` or any frozen milestone code.

## 8. Success Criteria

1. `https://kelvinxxle.github.io/title-run/` loads with **no 404s** on JS/CSS
   (assets resolve under the `/title-run/` base).
2. A full run is playable end-to-end on the deployed site: draft → fight →
   reward/hub, and localStorage persistence (park & resume) works.
3. Renders correctly with no horizontal scroll at iPhone (390px) width.
4. Pushing/merging to `main` triggers `deploy.yml` and the site updates
   automatically; the deploy job shows a green run and the `github-pages`
   environment URL.
5. Safari toolbar reflects the dark `theme-color`.

## 9. Testing

- **Automated:** existing suite (`vitest run`) must stay fully green; `base`
  change must not affect any test (vitest ignores `base`). No new unit tests are
  required (this is config/infra), but the implementer must run the full gate
  (`vitest run`, `tsc --noEmit`, `vite build`) and confirm `vite build` emits a
  `dist/index.html` whose asset `src`/`href` attributes are prefixed with
  `/title-run/`.
- **Deploy verification (orchestrator, post-merge):** confirm the Actions deploy
  run is green, the Pages URL is live, assets load (curl the deployed
  `index.html` + one hashed asset → HTTP 200), and a manual play-through works,
  including at iPhone width.

## 10. Delivery

- One PR into `main` containing: `.github/workflows/deploy.yml`,
  `vite.config.ts` (base), `index.html` (theme-color), and this spec committed
  to `docs/superpowers/specs/2026-07-01-ship-github-pages-design.md`.
- Every commit must carry the trailer:
  `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`.
- Review pipeline before merge: GPT-5.5 @ xhigh code-review + Copilot PR review.
- Pages enablement + post-merge deploy verification done by the orchestrator.
