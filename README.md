# Galaxia

Galaxia is a neon sci-fi arcade shooter built with React, Canvas 2D, Vite, and Capacitor. React owns menus and the in-game HUD; the fixed-step simulation and layered renderer remain canvas-first.

## Development

Requirements: Node.js 20 or newer.

```bash
npm ci
npm run dev
```

Create a production bundle with:

```bash
npm run build
```

## UI/UX Overhaul

The 2026 UI/UX work is intentionally recorded as a **large presentation refactor**. It replaces the runtime styling path and updates nearly every player-facing surface while preserving gameplay rules, reducer actions, simulation budgets, and canvas ownership.

- Refactor branch: `agent/galaxia-ui-ux-overhaul`
- Pre-refactor commit: `7828c52`
- Rollback tag: `pre-ui-ux-overhaul-2026-07-09`
- Detailed scope and rollback procedure: [docs/UI_UX_OVERHAUL.md](docs/UI_UX_OVERHAUL.md)

Do not remove the baseline tag after merge. It is the stable recovery point for the pre-overhaul interface.

## Architecture

- `App.tsx`: application lifecycle, boot sequence, audio routing, and game/menu composition
- `components/ui/`: React screens, HUD, transitions, and Galaxia UI primitives
- `components/canvas/`: layered Canvas 2D rendering and cached visual effects
- `gameLogic/`, `state/`, `hooks/useGameLoop.ts`: fixed-step gameplay simulation and reducer state
- `utils/uiPerformance.ts`: presentation-only device tier and accessibility preferences
- `android/`, `ios/`: Capacitor native shells
