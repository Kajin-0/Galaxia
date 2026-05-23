import type { GameState } from '../types';
import { GameStatus } from '../types';
import * as C from '../constants';

export const getProjectileColor = (state: GameState): string => {
    if (state.status === GameStatus.TrainingSim) {
        return C.PROJECTILE_COLOR_DEFAULT;
    }
    if (state.activeRareConsumable?.type === 'corrosive') {
        return C.PROJECTILE_COLOR_CORROSIVE;
    }
    if (state.selectedHero === 'alpha' && state.heroUpgrades.alpha_aoe_level >= 3) {
        return C.PROJECTILE_COLOR_ALPHA_L3;
    }
    if (state.activePowerUps.RapidFire || state.hasPermanentRapidFire) {
        return C.PROJECTILE_COLOR_RAPID_FIRE;
    }
    if (state.activePowerUps.SpreadShot) {
        return C.PROJECTILE_COLOR_SPREAD_SHOT;
    }
    return C.PROJECTILE_COLOR_DEFAULT;
};
