
import React, { useState, useEffect, useRef } from 'react';

export const ScreenOverlay: React.FC<{ children: React.ReactNode; className?: string; }> = ({ children, className = '' }) => (
  <div 
    className={`absolute inset-0 bg-slate-950 bg-opacity-80 backdrop-blur-sm flex flex-col justify-center items-center text-center text-white z-20 pointer-events-auto ${className}`}
    style={{
        paddingTop: 'calc(2rem + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'calc(2rem + env(safe-area-inset-left, 0px))',
        paddingRight: 'calc(2rem + env(safe-area-inset-right, 0px))',
    }}
  >
    {children}
  </div>
);

export const CurrencyIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.158-.103.346-.196.552-.257l-2.206-.858a3.002 3.002 0 00-1.802.31 3.002 3.002 0 00-1.23 2.065 3.003 3.003 0 00.32 2.382c.11.192.24.363.388.51l-2.017.8a.75.75 0 01-1.04-1.04l2.017-.8a3.003 3.003 0 00-1.183-4.735 3.003 3.003 0 003.417 1.037z" /><path d="M11.567 12.582c-.158.103-.346.196-.552.257l2.206.858a3.002 3.002 0 001.802-.31 3.002 3.002 0 001.23-2.065 3.003 3.003 0 00-.32-2.382c-.11-.192-.24-.363-.388.51l2.017-.8a.75.75 0 011.04 1.04l-2.017.8a3.003 3.003 0 001.183 4.735 3.003 3.003 0 00-3.417-1.037z" /></svg>;

export const UpgradePartIcon: React.FC = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0L8 7.05H4.26c-1.56.38-2.22 2.36-1.05 3.53l2.92 2.92c.38.38.38 1 0 1.4l-2.92 2.92c-1.18 1.18-.52 3.15 1.05 3.53H8l.51 3.88c.38 1.56 2.6 1.56 2.98 0l.51-3.88h3.74c1.56-.38-2.22-2.36 1.05-3.53l-2.92-2.92a.996.996 0 010-1.4l2.92-2.92c-1.18-1.18.52-3.15-1.05-3.53H12l-.51-3.88z" clipRule="evenodd" /></svg>;

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