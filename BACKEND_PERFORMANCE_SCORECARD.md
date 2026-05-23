# Backend Performance Scorecard

This scorecard defines the backend performance standard for this project.

Scope is backend only:
- Simulation and state updates
- Collision and AI logic
- Input processing and memory/GC behavior

Out of scope:
- UI/UX design
- Visual style, effects aesthetics, and art direction

## Core Principle

Optimize for old mobile hardware first with one simple, robust runtime path.

- No adaptive per-device complexity in hot backend loops
- Conservative fixed budgets that remain stable under late-game density
- Prefer predictable frame pacing over peak throughput

## Locked Mobile Backend Budgets

These values are intentionally conservative and should be treated as defaults.

Source: `constants.ts`

- `MOBILE_MAX_SIMULATION_STEPS_PER_FRAME = 2`
- `MOBILE_MAX_FRAME_DELTA_S = 0.18`
- `MOBILE_HOMING_TARGET_BUCKET_SIZE = 140`
- `MOBILE_DODGER_PROJECTILE_BUCKET_SIZE = 140`
- `MOBILE_DODGER_SCAN_INTERVAL_MS = 48`
- `MOBILE_DODGER_MAX_THREATS = 6`

## Required Backend Architecture Rules

### 1) Simulation Path

Source: `hooks/useGameLoop.ts`, `state/reducer.ts`, `state/engineReducer.ts`

- Simulation dispatch must use one action path: `GAME_TICK_BATCH`
- No legacy single-step simulation action in public reducer flow
- No extra per-frame simulation dispatches outside the game loop
- Keep fixed-step logic deterministic

### 2) Collision and Entity Cleanup

Source: `gameLogic/collision.ts`

- Keep in-place compaction for hot filtering paths
- Do not reintroduce per-tick full array rebuild patterns in collision hot paths
- Keep broadphase guards for obviously non-colliding projectile ranges
- Prefer loop-based hot-path logic over allocation-heavy iterator chains

### 3) AI Scan Boundaries

Source: `gameLogic/update.ts`, `gameLogic/ai.ts`

- Keep bucketed nearest-target and threat scans
- Do not reintroduce full-list scans in dense loops
- Respect conservative scan interval and max-threat budgets on mobile

### 4) Memory and GC Discipline

Source: `gameLogic/engine.ts`, `gameLogic/collision.ts`, `gameLogic/ai.ts`

- Reuse arrays/objects in hot loops whenever possible
- Avoid unbounded temporary growth (`Map`, `Set`, queued effects)
- Avoid spread-heavy object churn in per-entity or per-projectile loops
- Keep cleanup logic deterministic and bounded

### 5) Input Update Stability

Source: `hooks/useInputHandler.ts`, `state/inputReducer.ts`

- Coalesce touch move updates to frame cadence
- Ignore no-op touch updates that do not change effective state
- Keep start/end touch handling immediate for responsiveness

## Must-Pass Release Validation

Run on every backend performance change.

### Static Checks

- `npx eslint <touched backend files>`
- `npm run build`

### Runtime Checks (Manual)

Run at least one late-game stress session (Level 25+ hard mode) on mobile hardware.

Must verify:
- No simulation runaway catch-up spikes
- No severe frame pacing hitching during high object density
- Collision correctness remains intact (including crit/AOE and conduit shield behavior)
- Boss phase transitions remain correct
- Touch responsiveness remains consistent

## Backend Rating Rubric (Internal)

- `9.5 - 10.0`: Exceptional stability and efficiency on older devices in dense late-game scenarios
- `9.0 - 9.4`: Strong production-level backend performance with minor residual hotspots
- `8.5 - 8.9`: Good backend performance, but noticeable stress-case inefficiencies remain
- `< 8.5`: Requires targeted optimization before claiming mobile robustness

## Regression Response Order

If runtime regressions appear, revert or reduce in this order:

1. New hot-path allocations
2. AI scan breadth/frequency changes
3. Collision loop changes
4. Simulation budget changes

Then re-run full validation before merge.

## Change Control

Any change to locked mobile budget constants should include:

- A short reason for change
- Before/after observation from late-game mobile run
- Confirmation that lint/build and manual runtime checks passed
