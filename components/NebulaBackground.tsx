
import React from 'react';

export const NebulaBackground: React.FC = React.memo(() => (
    <div className="absolute inset-0 z-0">
        <div className="starfield"></div>
        <div className="nebula-container"></div>
    </div>
));
