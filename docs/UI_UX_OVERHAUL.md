# Galaxia UI/UX Overhaul

## Large Refactor Notice

This change is a large, cross-screen presentation refactor. It deliberately changes the styling build, boot experience, UI primitives, start flow, menus, HUD, pause composition, narrative screens, feedback effects, haptics, and accessibility behavior in one coordinated branch.

It does **not** intentionally change weapon rules, enemy behavior, progression costs, encounter outcomes, scoring, collision logic, fixed-step timing, or mobile simulation budgets.

## Recovery Point

The exact interface baseline before this work is:

```text
commit: 7828c52
tag:    pre-ui-ux-overhaul-2026-07-09
branch: main
```

The annotated tag is pushed separately from the refactor branch so the baseline remains available even if the pull request is later merged or rebased.

## Rollback Options

Create a branch at the old interface without changing shared history:

```bash
git fetch --tags origin
git switch -c rollback/pre-ui-overhaul pre-ui-ux-overhaul-2026-07-09
```

Compare the current checkout with the baseline:

```bash
git diff --stat pre-ui-ux-overhaul-2026-07-09..HEAD
git diff pre-ui-ux-overhaul-2026-07-09..HEAD
```

If the pull request was merged with a merge commit, prefer a normal revert:

```bash
git revert -m 1 <merge-commit-sha>
```

Avoid force-resetting a shared branch. The tag exists so recovery can use a new branch or a revert commit.

## Delivered Scope

### Foundation

- Built Tailwind/PostCSS pipeline replaces the runtime Tailwind CDN.
- Semantic color, surface, glow, spacing, and motion tokens.
- Galaxia-specific `ScreenShell`, `GlassPanel`, `NeonButton`, `StatBar`, `CurrencyChip`, `Badge`, `Toggle`, and `Slider` primitives.
- Tier 0/1/2 presentation profiling that can only downgrade after frame sampling.
- Reduced-motion, reduced-transparency, safe-area, focus, and color-safe behavior.

### Player Experience

- Staged cinematic boot reporting tied to real preload and cache warmup work.
- Canvas-rendered ship selection using the gameplay craft renderer.
- Unified launch hub, progression screens, narrative screens, outcomes, and pause controls.
- Frozen gameplay remains visible under pause; simulation and clock behavior are unchanged.
- Presentation-only status transition director and prioritized in-game messages.

### Gameplay Feedback

- Reorganized HUD hierarchy, segmented progress, magazine ammunition, status cues, and 30 fps clock-driven updates.
- Cached damage-number sprites and tier-based draw caps without truncating simulation state.
- Existing screen shake, flash, pools, caches, pickup paths, and effect ownership remain intact.
- Capacitor-native semantic haptics with Web Vibrate fallback.
- Tier-gated music-reactive ambience.

## Performance Guardrails

- Gameplay simulation constants are not connected to UI performance tiers.
- Tier 0 disables backdrop blur, shimmer, secondary nebula layers, and selected preview animation.
- Ship previews cap animation at 20 fps and remain static when unselected.
- Hidden menu scenes and paused canvases are not redrawn.
- HUD animation uses transforms and opacity; time-only rendering is capped near 30 fps.
- Damage-number limits affect drawing only, never collision or pooled state.

## Validation Record

The pull request description is the source of truth for commands run on the final commit, skipped native checks, and measured bundle output.
