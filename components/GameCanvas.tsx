import React, { forwardRef } from 'react';
import * as C from '../constants';

// This is now a simple, "dumb" component that only renders a canvas and forwards a ref.
// All animation loop and drawing logic has been removed and centralized.
const GameCanvas = forwardRef<HTMLCanvasElement>((props, ref) => (
  <canvas
    ref={ref}
    width={C.GAME_WIDTH}
    height={C.GAME_GRID_HEIGHT + C.GAME_HEIGHT_BUFFER}
    className="absolute inset-0 pointer-events-none"
    style={{
      width: `${C.GAME_WIDTH}px`,
      height: `${C.GAME_GRID_HEIGHT + C.GAME_HEIGHT_BUFFER}px`,
      zIndex: 10,
      // The canvas element itself has the correct height, so we adjust its position
      // using style properties to match the original layout.
      top: 0,
      left: 0,
      right: 0,
      bottom: `-${C.GAME_HEIGHT_BUFFER}px`
    }}
    aria-hidden="true"
  />
));

export default React.memo(GameCanvas);
