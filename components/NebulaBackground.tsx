
import React from 'react';

interface NebulaBackgroundProps {
    variant?: 'default' | 'ion_storm';
}

export const NebulaBackground: React.FC<NebulaBackgroundProps> = React.memo(({ variant = 'default' }) => {
    // Ion Storm variant applies a strong hue shift and contrast boost to create an "electric" atmosphere
    const containerStyle: React.CSSProperties = variant === 'ion_storm' ? {
        filter: 'hue-rotate(90deg) contrast(1.5) brightness(1.2)',
        transform: 'scale(1.1)', // Slight zoom to make it feel more oppressive
    } : {};

    return (
        <div className="absolute inset-0 z-0">
            <div className="starfield"></div>
            <div className="nebula-container" style={containerStyle}></div>
        </div>
    );
});
