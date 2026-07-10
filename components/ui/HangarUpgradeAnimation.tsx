import React, { useEffect, useMemo, useState } from 'react';
import { Check, Sparkles } from 'lucide-react';

interface Particle {
    id: number;
    offsetX: number;
    offsetY: number;
    rotation: number;
    size: number;
    delay: number;
    duration: number;
    color: string;
}

type CelebrationTier = 0 | 1 | 2;

const PARTICLE_COLORS = ['#67e8f9', '#c4b5fd', '#bef264', '#fde047'];

const readCelebrationTier = (): CelebrationTier => {
    if (typeof document === 'undefined') return 1;
    const value = document.documentElement.dataset.performanceTier;
    if (value === '0' || value === 'tier-0' || value === 'low') return 0;
    if (value === '2' || value === 'tier-2' || value === 'high') return 2;
    return 1;
};

const prefersReducedMotion = () => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

const generateParticles = (count: number, tier: CelebrationTier): Particle[] => {
    const maximumDistance = tier === 2 ? 112 : tier === 1 ? 84 : 56;
    const minimumDistance = tier === 2 ? 48 : 36;

    return Array.from({ length: count }, (_, index) => {
        const angle = Math.random() * Math.PI * 2;
        const distance = minimumDistance + Math.random() * (maximumDistance - minimumDistance);
        return {
            id: index,
            offsetX: Math.cos(angle) * distance,
            offsetY: Math.sin(angle) * distance,
            rotation: Math.round(Math.random() * 240 - 120),
            size: Math.random() * 4 + 3,
            delay: Math.random() * 100,
            duration: Math.random() * 220 + 440,
            color: PARTICLE_COLORS[index % PARTICLE_COLORS.length],
        };
    });
};

export const HangarUpgradeAnimation: React.FC<{ x: number; y: number }> = ({ x, y }) => {
    const tier = useMemo(readCelebrationTier, []);
    const reducedMotion = useMemo(prefersReducedMotion, []);
    const particleCount = reducedMotion ? 0 : tier === 0 ? 6 : tier === 1 ? 16 : 26;
    const particles = useMemo(() => generateParticles(particleCount, tier), [particleCount, tier]);
    const [launched, setLaunched] = useState(false);

    useEffect(() => {
        if (reducedMotion) return undefined;
        const frame = window.requestAnimationFrame(() => setLaunched(true));
        return () => window.cancelAnimationFrame(frame);
    }, [reducedMotion]);

    return (
        <div
            className="pointer-events-none fixed inset-0 z-50"
            data-effect-tier={tier}
            role="status"
            aria-live="polite"
            aria-atomic="true"
        >
            <span className="sr-only">Upgrade installation complete.</span>

            {!reducedMotion && (
                <span
                    className="absolute h-12 w-12 rounded-full border-2 border-cyan-200/70 shadow-neon-cyan"
                    style={{
                        left: x,
                        top: y,
                        opacity: launched ? 0 : 0.9,
                        transform: launched
                            ? 'translate(-50%, -50%) scale(3.4)'
                            : 'translate(-50%, -50%) scale(0.35)',
                        transition: 'transform 620ms cubic-bezier(0.16, 1, 0.3, 1), opacity 620ms ease-out',
                    }}
                    aria-hidden="true"
                />
            )}

            {particles.map(particle => (
                <span
                    key={particle.id}
                    className="absolute rounded-full shadow-[0_0_10px_currentColor]"
                    style={{
                        left: x,
                        top: y,
                        width: particle.size,
                        height: particle.size,
                        color: particle.color,
                        backgroundColor: particle.color,
                        opacity: launched ? 0 : 1,
                        transform: launched
                            ? `translate(-50%, -50%) translate(${particle.offsetX}px, ${particle.offsetY}px) rotate(${particle.rotation}deg) scale(0)`
                            : 'translate(-50%, -50%) rotate(0deg) scale(1)',
                        transitionProperty: 'transform, opacity',
                        transitionDuration: `${particle.duration}ms`,
                        transitionDelay: `${particle.delay}ms`,
                        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    aria-hidden="true"
                />
            ))}

            <span
                className="absolute flex h-11 w-11 items-center justify-center rounded-full border border-lime-200/70 bg-slate-950/90 text-lime-200 shadow-[0_0_24px_rgba(163,230,53,0.35)]"
                style={{
                    left: x,
                    top: y,
                    opacity: reducedMotion ? 1 : launched ? 0 : 1,
                    transform: reducedMotion
                        ? 'translate(-50%, -50%)'
                        : launched
                            ? 'translate(-50%, -50%) scale(1.45)'
                            : 'translate(-50%, -50%) scale(0.72)',
                    transition: reducedMotion
                        ? undefined
                        : 'transform 520ms cubic-bezier(0.16, 1, 0.3, 1), opacity 680ms ease-out 180ms',
                }}
                aria-hidden="true"
            >
                {tier === 2 && !reducedMotion
                    ? <Sparkles className="h-6 w-6" />
                    : <Check className="h-6 w-6" />}
            </span>
        </div>
    );
};
