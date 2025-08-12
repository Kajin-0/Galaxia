import React from 'react';
import type { WeaverBeam as WeaverBeamType } from '../types';
import { WEAVER_BEAM_DURATION } from '../constants';

interface WeaverBeamProps {
  beam: WeaverBeamType;
  now: number;
}

const WeaverBeamComponent: React.FC<WeaverBeamProps> = ({ beam, now }) => {
    const timeAlive = now - beam.createdAt;
    const fadeDuration = 300; // ms
    
    let opacity = 1;
    if (timeAlive < fadeDuration) {
        opacity = timeAlive / fadeDuration; // Fade in
    } else if (timeAlive > WEAVER_BEAM_DURATION - fadeDuration) {
        opacity = (WEAVER_BEAM_DURATION - timeAlive) / fadeDuration; // Fade out
    }
    
    return (
        <div
            className="absolute left-0 w-full pointer-events-none"
            style={{
                top: `${beam.y}px`,
                height: '4px',
                background: 'linear-gradient(90deg, transparent 0%, #f472b6 20%, #ec4899 50%, #f472b6 80%, transparent 100%)',
                boxShadow: '0 0 8px #f472b6, 0 0 15px #ec4899',
                filter: 'blur(1px)',
                opacity,
                zIndex: 10,
                animation: 'weaver-beam-crackle 100ms infinite',
                transform: 'translateZ(10px)',
            }}
        >
             <style>{`
                @keyframes weaver-beam-crackle {
                    0% { transform: scaleY(1); }
                    50% { transform: scaleY(1.5); }
                    100% { transform: scaleY(1); }
                }
            `}</style>
        </div>
    );
};

export default React.memo(WeaverBeamComponent);
