import React, { forwardRef } from 'react';
import * as C from '../constants';

// This is now a simple, "dumb" component that only renders a canvas and forwards a ref.
// All animation loop and drawing logic has been removed and centralized.
const GridCanvas = forwardRef<HTMLCanvasElement>((props, ref) => (
  <canvas
    ref={ref}
    // Set explicit canvas dimensions to prevent default 300x150 sizing.
    width={C.GAME_WIDTH}
    height={C.GAME_GRID_HEIGHT}
    className="absolute inset-0 pointer-events-none"
    style={{
      // Also set CSS dimensions to ensure it scales correctly in the layout.
      width: `${C.GAME_WIDTH}px`,
      height: `${C.GAME_GRID_HEIGHT}px`,
      zIndex: 1,
    }}
    aria-hidden="true"
  />
));

export default React.memo(GridCanvas);
