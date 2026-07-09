
import React, { useState, useEffect, useRef } from 'react';
import { Coins, Gem, Wrench } from 'lucide-react';
import { ScreenShell } from './primitives';

export {
  Badge,
  CurrencyChip,
  GlassPanel,
  NeonButton,
  ScreenShell,
  Slider,
  StatBar,
  Toggle,
  cx,
} from './primitives';

export const ScreenOverlay: React.FC<{ children: React.ReactNode; className?: string; dim?: 'none' | 'soft' | 'strong' }> = ({ children, className = '', dim = 'strong' }) => (
  <ScreenShell className={className} contentClassName="justify-center text-center" dim={dim}>
    {children}
  </ScreenShell>
);

export const CurrencyIcon: React.FC<{ className?: string }> = ({ className = 'h-6 w-6' }) => (
  <Coins className={className} aria-hidden="true" />
);

export const UpgradePartIcon: React.FC<{ className?: string }> = ({ className = 'h-6 w-6' }) => (
  <Wrench className={className} aria-hidden="true" />
);

export const CrystaliteIcon: React.FC<{ className?: string }> = ({ className = 'h-6 w-6' }) => (
  <Gem className={className} aria-hidden="true" />
);

export const formatTime = (ms: number) => {
    if (ms <= 0) return "00:00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const CountdownTimer: React.FC<{ completionTime: number }> = ({ completionTime }) => {
    const { useState, useEffect } = React;
    const [remaining, setRemaining] = useState(completionTime - Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            const newRemaining = completionTime - Date.now();
            if (newRemaining <= 0) {
                setRemaining(0);
                clearInterval(interval);
            } else {
                setRemaining(newRemaining);
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [completionTime]);

    return <span className="font-mono">{formatTime(remaining)}</span>;
};

export const AnimatedNumber: React.FC<{ value: number }> = React.memo(({ value }) => {
    const [displayValue, setDisplayValue] = useState(value);
    const prevValueRef = useRef(value);

    useEffect(() => {
        const startValue = prevValueRef.current;
        const endValue = value;

        if (startValue === endValue) {
            // If value hasn't changed, ensure display is correct and exit.
            setDisplayValue(endValue);
            return;
        }

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduceMotion) {
            setDisplayValue(endValue);
            prevValueRef.current = endValue;
            return;
        }

        const duration = 500;
        let animationFrameId: number;
        let startTime: number;

        const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = (timestamp - startTime) / duration;

            if (progress < 1) {
                const currentVal = Math.round(startValue + (endValue - startValue) * progress);
                setDisplayValue(currentVal);
                animationFrameId = requestAnimationFrame(step);
            } else {
                setDisplayValue(endValue);
            }
        };

        animationFrameId = requestAnimationFrame(step);

        // Update the ref to the new value for the next animation cycle
        prevValueRef.current = endValue;

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [value]);

    return <>{displayValue.toLocaleString()}</>;
});
