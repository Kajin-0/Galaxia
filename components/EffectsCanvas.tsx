import React, { forwardRef } from 'react';
import * as C from '../constants';

// This is now a simple, "dumb" component that only renders a canvas and forwards a ref.
// All animation loop, drawing, and noise canvas logic has been removed and centralized.
const EffectsCanvas = forwardRef<HTMLCanvasElement>((props, ref) => (
  <canvas
    ref={ref}
    width={C.GAME_WIDTH}
    height={C.GAME_GRID_HEIGHT + C.EFFECTS_CANVAS_TOP_BUFFER + C.GAME_HEIGHT_BUFFER}
    className="absolute inset-0 pointer-events-none"
    style={{
      width: `${C.GAME_WIDTH}px`,
      height: `${C.GAME_GRID_HEIGHT + C.EFFECTS_CANVAS_TOP_BUFFER + C.GAME_HEIGHT_BUFFER}px`,
      zIndex: 12,
      // Position the oversized canvas to cover the full effects area.
      top: `-${C.EFFECTS_CANVAS_TOP_BUFFER}px`,
      left: 0,
      right: 0,
      bottom: `-${C.GAME_HEIGHT_BUFFER}px`,
    }}
    aria-hidden="true"
  />
));

export default React.memo(EffectsCanvas);
