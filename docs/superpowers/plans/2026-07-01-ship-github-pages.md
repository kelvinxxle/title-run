# Ship Title Run to GitHub Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the existing Title Run static SPA to GitHub Pages with automated redeploy on push to `main`, and make it play correctly on iPhone Safari.

**Architecture:** Add a GitHub Actions workflow that builds the Vite app and publishes `dist/` to GitHub Pages (deploy source = "GitHub Actions"). Set Vite `base: '/title-run/'` so assets resolve under the project-page subpath. Add one dark `theme-color` meta tag. No gameplay/domain/UI-behavior change.

**Tech Stack:** Vite 5, React 18, TypeScript, GitHub Actions, GitHub Pages.

## Global Constraints

- Base branch: `main` @ `b9c521775`. Work on a dedicated feature branch; open ONE PR into `main`.
- Every commit MUST end with the trailer, verbatim (note the word "App"):
  `Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>`
- Do NOT modify `src/domain/**`, any screen/component behavior, `package.json`, or the lockfile. No new dependencies.
- Do NOT change or merge the existing `.github/workflows/` `build-and-test` workflow.
- Full gate must stay green after every code task: `npx vitest run`, `npx tsc --noEmit`, `npx vite build`.
- Deploy source URL target: `https://kelvinxxle.github.io/title-run/`.
- Push after every commit and verify `git rev-parse HEAD == git rev-parse @{u}` (do not leave commits unpushed).

---

### Task 1: Commit the design spec + plan into the repo

**Files:**
- Create: `docs/superpowers/specs/2026-07-01-ship-github-pages-design.md`
- Create: `docs/superpowers/plans/2026-07-01-ship-github-pages.md`

**Interfaces:**
- Consumes: nothing.
- Produces: in-repo provenance docs. No code surface.

- [ ] **Step 1: Add the spec and plan files**

Copy the approved spec (provided by the orchestrator) verbatim into
`docs/superpowers/specs/2026-07-01-ship-github-pages-design.md`, and this plan
into `docs/superpowers/plans/2026-07-01-ship-github-pages.md`. Create the
directories if they do not exist.

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-07-01-ship-github-pages-design.md docs/superpowers/plans/2026-07-01-ship-github-pages.md
git commit -m "docs: ship-to-GitHub-Pages spec + implementation plan

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
git push && test "$(git rev-parse HEAD)" = "$(git rev-parse @{u})" && echo PUSH_OK
```
Expected: `PUSH_OK`.

---

### Task 2: Vite base path + dark theme-color meta

**Files:**
- Modify: `vite.config.ts`
- Modify: `index.html`

**Interfaces:**
- Consumes: nothing.
- Produces: a build whose `dist/index.html` references assets under `/title-run/…`.

- [ ] **Step 1: Set the Vite base path**

In `vite.config.ts`, add a top-level `base` property to the `defineConfig({…})`
object (alongside `plugins`), so it reads:

```ts
export default defineConfig({
  base: '/title-run/',
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
  },
});
```

- [ ] **Step 2: Add the theme-color meta tag**

In `index.html`, immediately after the existing viewport meta line, add:

```html
    <meta name="theme-color" content="#0e0e0e" />
```

(`#0e0e0e` is the app's `background` token from `src/theme/tokens.ts`.)

- [ ] **Step 3: Verify the build emits base-prefixed assets**

Run:
```bash
npx vite build && grep -c '/title-run/assets/' dist/index.html
```
Expected: build succeeds and grep prints a count `>= 1` (asset `src`/`href`
attributes are prefixed with `/title-run/`). If the count is `0`, the `base`
did not take effect — fix before proceeding.

- [ ] **Step 4: Run the full gate**

Run:
```bash
npx vitest run && npx tsc --noEmit && npx vite build
```
Expected: all tests pass (same count as `main`, currently 163), typecheck clean,
build ok. `base` must not change any test result (vitest ignores `base`).

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts index.html
git commit -m "build: set Vite base to /title-run/ and add dark theme-color for GitHub Pages

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
git push && test "$(git rev-parse HEAD)" = "$(git rev-parse @{u})" && echo PUSH_OK
```
Expected: `PUSH_OK`.

---

### Task 3: GitHub Actions deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: the `npm run build` output (`dist/`) from Task 2's config.
- Produces: an automated Pages deploy on push to `main`.

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/deploy.yml` with EXACTLY this content:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Validate the YAML parses**

Run:
```bash
python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml')); print('YAML_OK')"
```
Expected: `YAML_OK`. (If `pyyaml` is unavailable, instead confirm indentation
matches the block above exactly — 2-space, no tabs.)

- [ ] **Step 3: Confirm the existing workflow is untouched**

Run:
```bash
git status --porcelain .github/workflows/
```
Expected: only `deploy.yml` shows as added (`A`/`??`); no modification to any
existing workflow file.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Pages deploy workflow (build + deploy on push to main)

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"
git push && test "$(git rev-parse HEAD)" = "$(git rev-parse @{u})" && echo PUSH_OK
```
Expected: `PUSH_OK`.

---

### Task 4: Open the PR

**Files:** none.

- [ ] **Step 1: Open a PR into `main`**

```bash
gh pr create --base main --title "Ship: deploy Title Run to GitHub Pages" \
  --body "Deploys the static SPA to GitHub Pages with auto-redeploy on push to main. Sets Vite base=/title-run/, adds a dark theme-color meta, and a deploy workflow. No gameplay/domain change. Spec: docs/superpowers/specs/2026-07-01-ship-github-pages-design.md"
```

- [ ] **Step 2: Report PR number, final HEAD, and gate results back to the orchestrator.**

Report: PR URL/number, final HEAD SHA (confirm `HEAD == @{u}`), and the
`vitest`/`tsc`/`vite build` gate output. Do NOT merge. The orchestrator runs the
review pipeline (GPT-5.5 xhigh + Copilot), then enables Pages
(`build_type: workflow`) and verifies the live deploy post-merge.

---

## Notes for the orchestrator (not implementer tasks)

- **Enable Pages (once, post-merge or anytime):**
  `gh api -X POST repos/kelvinxxle/title-run/pages -f build_type=workflow`
  (use `PUT` if it already exists / returns 409). Required for the deploy job to publish.
- **Post-merge verification:** confirm the "Deploy to GitHub Pages" run is green,
  then `curl -sI https://kelvinxxle.github.io/title-run/` → HTTP 200, and curl one
  hashed asset from `dist/index.html` → 200. Manually play a run at iPhone (390px) width.
