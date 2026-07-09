import { useEffect, useRef, useState } from 'react';

export type PerformanceTier = 0 | 1 | 2;

export interface UIPerformanceProfile {
    tier: PerformanceTier;
    reducedMotion: boolean;
    supportsBackdropFilter: boolean;
    hardwareConcurrency: number | null;
    deviceMemory: number | null;
}

export interface FrameSamplerOptions {
    durationMs?: number;
    minFrames?: number;
}

export interface UseUIPerformanceOptions {
    sampleFrames?: boolean;
    sampler?: FrameSamplerOptions;
}

type NavigatorWithDeviceMemory = Navigator & {
    readonly deviceMemory?: number;
};

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
const DEFAULT_SAMPLE_DURATION_MS = 1200;
const DEFAULT_MIN_SAMPLE_FRAMES = 24;

const getReducedMotionPreference = (): boolean => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(REDUCED_MOTION_QUERY).matches
);

const getBackdropFilterSupport = (): boolean => {
    if (typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
        return false;
    }

    return CSS.supports('backdrop-filter', 'blur(1px)')
        || CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
};

const getHardwareConcurrency = (): number | null => {
    if (typeof navigator === 'undefined') {
        return null;
    }

    const value = navigator.hardwareConcurrency;
    return Number.isFinite(value) && value > 0 ? value : null;
};

const getDeviceMemory = (): number | null => {
    if (typeof navigator === 'undefined') {
        return null;
    }

    const value = (navigator as NavigatorWithDeviceMemory).deviceMemory;
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * Capability detection is intentionally conservative. Tier 2 requires explicit
 * strong-device signals; missing browser hints remain at Tier 1.
 */
export const detectUIPerformance = (): UIPerformanceProfile => {
    const reducedMotion = getReducedMotionPreference();
    const supportsBackdropFilter = getBackdropFilterSupport();
    const hardwareConcurrency = getHardwareConcurrency();
    const deviceMemory = getDeviceMemory();

    let tier: PerformanceTier = 1;

    if (
        reducedMotion
        || !supportsBackdropFilter
        || (hardwareConcurrency !== null && hardwareConcurrency <= 2)
        || (deviceMemory !== null && deviceMemory <= 2)
    ) {
        tier = 0;
    } else if (
        hardwareConcurrency !== null
        && hardwareConcurrency >= 8
        && deviceMemory !== null
        && deviceMemory >= 8
    ) {
        tier = 2;
    }

    return {
        tier,
        reducedMotion,
        supportsBackdropFilter,
        hardwareConcurrency,
        deviceMemory,
    };
};

export const applyUIPerformanceAttributes = (
    profile: Pick<UIPerformanceProfile, 'tier' | 'reducedMotion'>,
    root: HTMLElement | null = typeof document !== 'undefined' ? document.documentElement : null,
): void => {
    if (!root) {
        return;
    }

    root.dataset.performanceTier = String(profile.tier);
    root.dataset.reducedMotion = String(profile.reducedMotion);
};

const measuredTierForFrames = (frameTimes: number[]): PerformanceTier => {
    const sorted = [...frameTimes].sort((a, b) => a - b);
    const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    const p95 = sorted[p95Index];
    const average = frameTimes.reduce((total, value) => total + value, 0) / frameTimes.length;
    const severelySlowRatio = frameTimes.filter(frameTime => frameTime > 34).length / frameTimes.length;

    if (p95 > 38 || average > 30 || severelySlowRatio > 0.3) {
        return 0;
    }

    if (p95 > 24 || average > 20) {
        return 1;
    }

    return 2;
};

/**
 * Samples a short rAF window and reports only a lower tier. The returned
 * cleanup function prevents callbacks after an owning component unmounts.
 */
export const sampleUIPerformance = (
    currentTier: PerformanceTier,
    onDowngrade: (tier: PerformanceTier) => void,
    options: FrameSamplerOptions = {},
): (() => void) => {
    if (
        currentTier === 0
        || typeof window === 'undefined'
        || typeof window.requestAnimationFrame !== 'function'
        || (typeof document !== 'undefined' && document.hidden)
    ) {
        return () => undefined;
    }

    const durationMs = Math.max(250, options.durationMs ?? DEFAULT_SAMPLE_DURATION_MS);
    const minFrames = Math.max(8, options.minFrames ?? DEFAULT_MIN_SAMPLE_FRAMES);
    const frameTimes: number[] = [];
    let startTime: number | null = null;
    let previousTime: number | null = null;
    let animationFrameId = 0;
    let cancelled = false;

    const finish = (): void => {
        if (cancelled || frameTimes.length < minFrames) {
            return;
        }

        const measuredTier = measuredTierForFrames(frameTimes);
        if (measuredTier < currentTier) {
            onDowngrade(measuredTier);
        }
    };

    const sample = (timestamp: number): void => {
        if (cancelled) {
            return;
        }

        if (typeof document !== 'undefined' && document.hidden) {
            cancelled = true;
            return;
        }

        startTime ??= timestamp;
        if (previousTime !== null) {
            frameTimes.push(timestamp - previousTime);
        }
        previousTime = timestamp;

        if (timestamp - startTime >= durationMs) {
            finish();
            return;
        }

        animationFrameId = window.requestAnimationFrame(sample);
    };

    animationFrameId = window.requestAnimationFrame(sample);

    return () => {
        cancelled = true;
        window.cancelAnimationFrame(animationFrameId);
    };
};

/**
 * Detects and publishes the UI capability profile. The media-query and rAF
 * subscriptions are removed when the component unmounts.
 */
export const useUIPerformance = (
    options: UseUIPerformanceOptions = {},
): UIPerformanceProfile => {
    const [profile, setProfile] = useState<UIPerformanceProfile>(detectUIPerformance);
    const sampledRef = useRef(false);
    const sampleFrames = options.sampleFrames ?? true;
    const sampleDurationMs = options.sampler?.durationMs;
    const sampleMinFrames = options.sampler?.minFrames;

    useEffect(() => {
        applyUIPerformanceAttributes(profile);
    }, [profile]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return undefined;
        }

        const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
        const handlePreferenceChange = (): void => {
            setProfile(detectUIPerformance());
        };

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handlePreferenceChange);
            return () => mediaQuery.removeEventListener('change', handlePreferenceChange);
        }

        mediaQuery.addListener(handlePreferenceChange);
        return () => mediaQuery.removeListener(handlePreferenceChange);
    }, []);

    useEffect(() => {
        if (!sampleFrames || sampledRef.current) {
            return undefined;
        }

        sampledRef.current = true;
        return sampleUIPerformance(
            profile.tier,
            tier => {
                setProfile(current => (
                    tier < current.tier ? { ...current, tier } : current
                ));
            },
            { durationMs: sampleDurationMs, minFrames: sampleMinFrames },
        );
    }, [profile.tier, sampleDurationMs, sampleFrames, sampleMinFrames]);

    return profile;
};

export const useUIPerformanceTier = (
    options: UseUIPerformanceOptions = {},
): PerformanceTier => useUIPerformance(options).tier;

const COLOR_MODE_STORAGE_KEY = 'galaxia.accessibility.colorSafe';

export const useColorSafeMode = (): [boolean, (enabled: boolean) => void] => {
    const [enabled, setEnabled] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.localStorage.getItem(COLOR_MODE_STORAGE_KEY) === 'true';
    });

    useEffect(() => {
        document.documentElement.dataset.colorSafe = String(enabled);
        window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, String(enabled));
    }, [enabled]);

    return [enabled, setEnabled];
};
