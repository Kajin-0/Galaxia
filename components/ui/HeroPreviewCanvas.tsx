import React, { useEffect, useRef } from 'react';
import type { HeroType } from '../../types';
import { drawPlayerPreview } from '../canvas/drawPlayer';

export interface HeroPreviewCanvasProps {
    hero: HeroType;
    selected?: boolean;
    locked?: boolean;
    className?: string;
}

const HERO_NAMES: Record<HeroType, string> = {
    alpha: 'Alpha',
    beta: 'Beta',
    gamma: 'Gamma',
};

const PREVIEW_FRAME_INTERVAL_MS = 50;
const MAX_DEVICE_PIXEL_RATIO = 2;

function performanceTierAllowsAnimation(): boolean {
    const tier = document.documentElement.dataset.performanceTier?.toLowerCase();
    return tier === '1'
        || tier === '2'
        || tier === 'tier-1'
        || tier === 'tier-2'
        || tier === 'mid'
        || tier === 'medium'
        || tier === 'high';
}

const HeroPreviewCanvasComponent: React.FC<HeroPreviewCanvasProps> = ({
    hero,
    selected = false,
    locked = false,
    className,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', {
            alpha: true,
            desynchronized: true,
        });
        if (!ctx) return;

        const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        let logicalWidth = 0;
        let logicalHeight = 0;
        let devicePixelRatio = 1;
        let animationTimeout: number | undefined;
        let animationFrame: number | undefined;
        let disposed = false;

        const cancelAnimation = () => {
            if (animationTimeout !== undefined) {
                window.clearTimeout(animationTimeout);
                animationTimeout = undefined;
            }
            if (animationFrame !== undefined) {
                window.cancelAnimationFrame(animationFrame);
                animationFrame = undefined;
            }
        };

        const animationAllowed = () => selected
            && !locked
            && !reducedMotionQuery.matches
            && performanceTierAllowsAnimation();

        const configureBackingStore = (width: number, height: number) => {
            logicalWidth = Math.max(1, width);
            logicalHeight = Math.max(1, height);
            devicePixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);

            const backingWidth = Math.max(1, Math.round(logicalWidth * devicePixelRatio));
            const backingHeight = Math.max(1, Math.round(logicalHeight * devicePixelRatio));
            if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
                canvas.width = backingWidth;
                canvas.height = backingHeight;
            }

            ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
        };

        const render = (now: number) => {
            if (disposed || logicalWidth <= 0 || logicalHeight <= 0) return;

            const nextDevicePixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO);
            if (nextDevicePixelRatio !== devicePixelRatio) {
                configureBackingStore(logicalWidth, logicalHeight);
            }

            ctx.clearRect(0, 0, logicalWidth, logicalHeight);
            drawPlayerPreview(ctx, {
                hero,
                centerX: logicalWidth / 2,
                centerY: logicalHeight / 2,
                maxWidth: logicalWidth * 0.94,
                maxHeight: logicalHeight * 0.94,
                now,
                animated: animationAllowed(),
            });
        };

        const scheduleAnimation = () => {
            if (disposed || document.hidden || !animationAllowed()) return;

            animationTimeout = window.setTimeout(() => {
                animationTimeout = undefined;
                animationFrame = window.requestAnimationFrame((now) => {
                    animationFrame = undefined;
                    render(now);
                    scheduleAnimation();
                });
            }, PREVIEW_FRAME_INTERVAL_MS);
        };

        const restartAnimation = () => {
            cancelAnimation();
            render(performance.now());
            scheduleAnimation();
        };

        const resize = (width: number, height: number) => {
            configureBackingStore(width, height);
            render(performance.now());
        };

        const initialRect = canvas.getBoundingClientRect();
        resize(initialRect.width, initialRect.height);

        let resizeObserver: ResizeObserver | undefined;
        const handleWindowResize = () => {
            const rect = canvas.getBoundingClientRect();
            resize(rect.width, rect.height);
        };

        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver((entries) => {
                const entry = entries[0];
                if (entry) resize(entry.contentRect.width, entry.contentRect.height);
            });
            resizeObserver.observe(canvas);
        } else {
            window.addEventListener('resize', handleWindowResize);
        }

        const tierObserver = new MutationObserver(restartAnimation);
        tierObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-performance-tier'],
        });

        document.addEventListener('visibilitychange', restartAnimation);
        reducedMotionQuery.addEventListener('change', restartAnimation);
        scheduleAnimation();

        return () => {
            disposed = true;
            cancelAnimation();
            resizeObserver?.disconnect();
            tierObserver.disconnect();
            window.removeEventListener('resize', handleWindowResize);
            document.removeEventListener('visibilitychange', restartAnimation);
            reducedMotionQuery.removeEventListener('change', restartAnimation);
        };
    }, [hero, locked, selected]);

    const label = `${HERO_NAMES[hero]} ship preview${locked ? ', locked' : ''}`;

    return (
        <canvas
            ref={canvasRef}
            width={1}
            height={1}
            className={className}
            role="img"
            aria-label={label}
            data-hero={hero}
            data-selected={selected ? 'true' : 'false'}
            data-locked={locked ? 'true' : 'false'}
            style={{
                display: 'block',
                width: '100%',
                height: '100%',
                opacity: locked ? 0.48 : 1,
                filter: locked ? 'grayscale(1) saturate(0.35)' : undefined,
            }}
        >
            {label}
        </canvas>
    );
};

export const HeroPreviewCanvas = React.memo(HeroPreviewCanvasComponent);
HeroPreviewCanvas.displayName = 'HeroPreviewCanvas';

export default HeroPreviewCanvas;
