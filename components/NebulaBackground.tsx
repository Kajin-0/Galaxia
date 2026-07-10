
import React, { useEffect, useRef } from 'react';
import { getMusicEnergy } from '../sounds';

interface NebulaBackgroundProps {
    variant?: 'default' | 'ion_storm';
}

export const NebulaBackground: React.FC<NebulaBackgroundProps> = React.memo(({ variant = 'default' }) => {
    const rootRef = useRef<HTMLDivElement>(null);
    // Ion Storm variant applies a strong hue shift and contrast boost to create an "electric" atmosphere
    const containerStyle: React.CSSProperties = variant === 'ion_storm' ? {
        filter: 'hue-rotate(90deg) contrast(1.5) brightness(1.2)',
        transform: 'scale(1.1)', // Slight zoom to make it feel more oppressive
    } : {};

    useEffect(() => {
        let timeoutId = 0;
        let frameId = 0;
        let disposed = false;

        const sample = () => {
            if (disposed) return;
            const highTier = document.documentElement.dataset.performanceTier === '2';
            const reduceMotion = document.documentElement.dataset.reducedMotion === 'true';
            const energy = highTier && !reduceMotion ? getMusicEnergy() : 0;
            rootRef.current?.style.setProperty('--music-energy', energy.toFixed(3));
            timeoutId = window.setTimeout(() => {
                frameId = window.requestAnimationFrame(sample);
            }, 84);
        };

        sample();
        return () => {
            disposed = true;
            window.clearTimeout(timeoutId);
            window.cancelAnimationFrame(frameId);
        };
    }, []);

    return (
        <div ref={rootRef} className="nebula-reactive absolute inset-0 z-0">
            <div className="starfield"></div>
            <div className="nebula-container" style={containerStyle}></div>
        </div>
    );
});
