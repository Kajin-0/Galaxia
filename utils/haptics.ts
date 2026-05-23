export type HapticPattern = 'explosion' | 'criticalHit' | 'playerDamage' | 'shieldBreak' | 'bossDefeat' | 'projectileImpact';

/**
 * Triggers a haptic feedback pattern on supported devices if haptics are enabled.
 * Uses the simple Web Vibrate API.
 * @param pattern The type of feedback to trigger.
 * @param hapticsEnabled A boolean indicating if haptics are globally enabled.
 */
export const triggerHaptic = (pattern: HapticPattern, hapticsEnabled: boolean) => {
    if (!hapticsEnabled) {
        return;
    }

    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try {
            switch (pattern) {
                case 'explosion':
                    window.navigator.vibrate(50);
                    break;
                case 'criticalHit':
                    window.navigator.vibrate([70, 40, 70]);
                    break;
                case 'playerDamage':
                    window.navigator.vibrate(200);
                    break;
                case 'shieldBreak':
                    window.navigator.vibrate(150);
                    break;
                case 'bossDefeat':
                    window.navigator.vibrate([500, 100, 500]);
                    break;
                case 'projectileImpact':
                    window.navigator.vibrate(20);
                    break;
            }
        } catch (e) {
            // Some browsers might throw an error if the user has disabled vibrations.
            // We can safely ignore this.
            // Haptic feedback failed, probably disabled by user
        }
    }
};