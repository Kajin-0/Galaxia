import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

export type HapticPattern =
    | 'explosion'
    | 'criticalHit'
    | 'playerDamage'
    | 'shieldBreak'
    | 'bossDefeat'
    | 'projectileImpact'
    | 'uiTap'
    | 'uiConfirm'
    | 'uiWarning';

const HAPTIC_THROTTLE_MS = 35;
let lastHapticAt = -HAPTIC_THROTTLE_MS;

const triggerNativeHaptic = async (pattern: HapticPattern): Promise<void> => {
    switch (pattern) {
        case 'projectileImpact':
        case 'uiTap':
            await Haptics.impact({ style: ImpactStyle.Light });
            break;
        case 'explosion':
            await Haptics.impact({ style: ImpactStyle.Medium });
            break;
        case 'criticalHit':
        case 'shieldBreak':
            await Haptics.impact({ style: ImpactStyle.Heavy });
            break;
        case 'bossDefeat':
        case 'uiConfirm':
            await Haptics.notification({ type: NotificationType.Success });
            break;
        case 'playerDamage':
            await Haptics.notification({ type: NotificationType.Error });
            break;
        case 'uiWarning':
            await Haptics.notification({ type: NotificationType.Warning });
            break;
    }
};

const triggerWebVibration = (pattern: HapticPattern): void => {
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
        return;
    }

    const webPatterns: Record<HapticPattern, number | number[]> = {
        explosion: 50,
        criticalHit: [70, 40, 70],
        playerDamage: 200,
        shieldBreak: 150,
        bossDefeat: [500, 100, 500],
        projectileImpact: 20,
        uiTap: 10,
        uiConfirm: [25, 30, 45],
        uiWarning: [60, 40, 60],
    };

    try {
        navigator.vibrate(webPatterns[pattern]);
    } catch {
        // Vibration can be disabled by browser or operating-system policy.
    }
};

/**
 * Triggers a haptic feedback pattern on supported devices if haptics are enabled.
 * Uses semantic Capacitor feedback on native platforms and Web Vibrate as a
 * browser or native-plugin failure fallback.
 * @param pattern The type of feedback to trigger.
 * @param hapticsEnabled A boolean indicating if haptics are globally enabled.
 */
export const triggerHaptic = (pattern: HapticPattern, hapticsEnabled: boolean): void => {
    if (!hapticsEnabled) {
        return;
    }

    const now = Date.now();
    if (now - lastHapticAt < HAPTIC_THROTTLE_MS) {
        return;
    }
    lastHapticAt = now;

    if (Capacitor.isNativePlatform()) {
        void triggerNativeHaptic(pattern).catch(() => triggerWebVibration(pattern));
        return;
    }

    triggerWebVibration(pattern);
};
