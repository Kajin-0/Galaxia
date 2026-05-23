import type { GameState, GameAction, GeneralUpgradeKey, HeroUpgradeKey, UpgradeConfig } from '../types';
import { GameStatus } from '../types';
import * as C from '../constants';
import { getProgressionFromState, saveProgression, type ProgressionData } from '../utils/progression';

export function gameReducer(state: GameState, action: GameAction): GameState {
    switch(action.type) {
        // --- IAP & CURRENCY ---
        case 'SIMULATE_PURCHASE': {
            const newProgression: ProgressionData = {
                ...getProgressionFromState(state),
                crystalite: state.crystalite + action.amount,
            };
            saveProgression(newProgression);
            return { ...state, crystalite: newProgression.crystalite };
        }
        case 'INITIATE_PURCHASE': {
            return {
                ...state,
                iap: {
                    ...state.iap,
                    currentPurchase: {
                        state: 'initiating',
                        productId: action.productId,
                        error: null,
                        progress: 0
                    }
                }
            };
        }
        case 'PURCHASE_INITIATED': {
            return {
                ...state,
                iap: {
                    ...state.iap,
                    currentPurchase: {
                        state: 'purchasing',
                        productId: action.productId,
                        error: null,
                        progress: 25
                    }
                }
            };
        }
        case 'PURCHASE_COMPLETED': {
            return {
                ...state,
                iap: {
                    ...state.iap,
                    currentPurchase: {
                        state: 'validating',
                        productId: action.receipt.productId,
                        error: null,
                        progress: 75
                    }
                }
            };
        }
        case 'PURCHASE_VALIDATION_COMPLETED': {
            // Grant currency only after successful validation
            const newProgression: ProgressionData = {
                ...getProgressionFromState(state),
                crystalite: state.crystalite + action.result.amount,
            };
            saveProgression(newProgression);
            
            return {
                ...state,
                crystalite: newProgression.crystalite,
                iap: {
                    ...state.iap,
                    currentPurchase: {
                        state: 'success',
                        productId: action.result.productId,
                        error: null,
                        progress: 100
                    }
                }
            };
        }
        case 'PURCHASE_FAILED': {
            return {
                ...state,
                iap: {
                    ...state.iap,
                    currentPurchase: {
                        state: 'failed',
                        productId: action.productId,
                        error: action.error,
                        progress: 0
                    }
                }
            };
        }
        case 'PURCHASE_VALIDATION_STARTED': {
            return {
                ...state,
                iap: {
                    ...state.iap,
                    currentPurchase: {
                        state: 'validating',
                        productId: action.receipt.productId,
                        error: null,
                        progress: 50
                    }
                }
            };
        }
        case 'PURCHASE_VALIDATION_FAILED': {
            return {
                ...state,
                iap: {
                    ...state.iap,
                    currentPurchase: {
                        state: 'failed',
                        productId: action.receipt.productId,
                        error: action.error,
                        progress: 0
                    }
                }
            };
        }
        case 'RESTORE_PURCHASES_STARTED': {
            return {
                ...state,
                iap: {
                    ...state.iap,
                    currentPurchase: {
                        state: 'restoring',
                        productId: null,
                        error: null,
                        progress: 0
                    }
                }
            };
        }
        case 'RESTORE_PURCHASES_COMPLETED': {
            return {
                ...state,
                iap: {
                    ...state.iap,
                    currentPurchase: {
                        state: 'idle',
                        productId: null,
                        error: null,
                        progress: 0
                    },
                    lastRestoreAttempt: Date.now()
                }
            };
        }
        case 'RESTORE_PURCHASES_FAILED': {
            return {
                ...state,
                iap: {
                    ...state.iap,
                    currentPurchase: {
                        state: 'failed',
                        productId: null,
                        error: action.error,
                        progress: 0
                    }
                }
            };
        }
        case 'IAP_AVAILABILITY_CHANGED': {
            return {
                ...state,
                iap: {
                    ...state.iap,
                    isAvailable: action.isAvailable,
                    canMakePayments: action.canMakePayments
                }
            };
        }
        case 'CLEAR_PURCHASE_ERROR': {
            return {
                ...state,
                iap: {
                    ...state.iap,
                    currentPurchase: {
                        ...state.iap.currentPurchase,
                        error: null
                    }
                }
            };
        }
        case 'CLEAR_PURCHASE_STATE': {
            return {
                ...state,
                iap: {
                    ...state.iap,
                    currentPurchase: {
                        state: 'idle',
                        productId: null,
                        error: null,
                        progress: 0
                    }
                }
            };
        }

        // --- HANGAR & UPGRADES ---
        case 'INSTA_FINISH_UPGRADE': {
            if (!state.ongoingUpgrade || state.crystalite < action.cost) {
                return state;
            }

            const newProgression: ProgressionData = {
                ...getProgressionFromState(state),
                crystalite: state.crystalite - action.cost,
                ongoingUpgrade: {
                    ...state.ongoingUpgrade,
                    completionTime: Date.now(),
                },
            };

            saveProgression(newProgression);
            return { ...state, crystalite: newProgression.crystalite, ongoingUpgrade: newProgression.ongoingUpgrade };
        }
        case 'BUY_UPGRADE_WITH_CRYSTALITE': {
            const { target, upgradeKey } = action;
            let currentLevel: number;
            let upgradeConfig: UpgradeConfig[];
            
            if (target === 'general') {
                currentLevel = state.generalUpgrades[upgradeKey as GeneralUpgradeKey];
                upgradeConfig = C.HANGAR_GENERAL_UPGRADE_CONFIG[upgradeKey as GeneralUpgradeKey];
            } else {
                currentLevel = state.heroUpgrades[upgradeKey as HeroUpgradeKey];
                switch (upgradeKey as HeroUpgradeKey) {
                    case 'alpha_aoe_level': upgradeConfig = C.HANGAR_ALPHA_UPGRADE_CONFIG; break;
                    case 'beta_homing_level': upgradeConfig = C.HANGAR_BETA_UPGRADE_CONFIG; break;
                    case 'gamma_shield_hp_level': upgradeConfig = C.HANGAR_GAMMA_UPGRADE_CONFIG; break;
                    default: return state;
                }
            }

            if (currentLevel >= upgradeConfig.length) return state;

            const nextLevelConfig = upgradeConfig[currentLevel];
            const crystaliteCost = Math.ceil((nextLevelConfig.currency / 400) + (nextLevelConfig.parts * 5));

            if (state.crystalite < crystaliteCost) return state;

            const newProgression = getProgressionFromState(state);
            newProgression.crystalite -= crystaliteCost;

            if (target === 'general') {
                (newProgression.generalUpgrades as any)[upgradeKey] = currentLevel + 1;
            } else {
                (newProgression.heroUpgrades as any)[upgradeKey] = currentLevel + 1;
            }

            saveProgression(newProgression);
            const { seenEnemies, ...progressionToApply } = newProgression;

            return { ...state, ...progressionToApply };
        }
        case 'START_UPGRADE': {
            if (state.ongoingUpgrade) return state; // Already upgrading something

            let config: UpgradeConfig;
            if (action.target === 'general') {
                config = C.HANGAR_GENERAL_UPGRADE_CONFIG[action.upgradeKey as GeneralUpgradeKey][action.level - 1];
            } else {
                switch(action.upgradeKey as HeroUpgradeKey) {
                    case 'alpha_aoe_level': config = C.HANGAR_ALPHA_UPGRADE_CONFIG[action.level - 1]; break;
                    case 'beta_homing_level': config = C.HANGAR_BETA_UPGRADE_CONFIG[action.level - 1]; break;
                    case 'gamma_shield_hp_level': config = C.HANGAR_GAMMA_UPGRADE_CONFIG[action.level - 1]; break;
                    default: return state; // Should not happen
                }
            }

            if (!config || state.totalCurrency < config.currency || state.upgradeParts < config.parts) {
                return state; // Cannot afford
            }

            const newProgression: ProgressionData = {
                ...getProgressionFromState(state),
                totalCurrency: state.totalCurrency - config.currency,
                upgradeParts: state.upgradeParts - config.parts,
                ongoingUpgrade: {
                    target: action.target,
                    upgradeKey: action.upgradeKey,
                    level: action.level,
                    completionTime: Date.now() + config.time,
                }
            };

            saveProgression(newProgression);
            const { seenEnemies, ...progressionToApply } = newProgression;
            return { ...state, ...progressionToApply };
        }
        case 'COLLECT_UPGRADE': {
            if (!state.ongoingUpgrade || Date.now() < state.ongoingUpgrade.completionTime) {
                return state; // Not finished yet
            }
            
            const { target, upgradeKey, level } = state.ongoingUpgrade;
            const newProgression = getProgressionFromState(state);

            if (target === 'general') {
                 (newProgression.generalUpgrades as any)[upgradeKey] = level;
            } else {
                (newProgression.heroUpgrades as any)[upgradeKey] = level;
            }
            newProgression.ongoingUpgrade = null;

            saveProgression(newProgression);
            const { seenEnemies, ...progressionToApply } = newProgression;
            return { ...state, ...progressionToApply };
        }

        // --- ARMORY CONSUMABLES ---
        case 'BUY_REVIVE':
        case 'BUY_FAST_RELOAD':
        case 'BUY_RAPID_FIRE':
        case 'BUY_SPEED_BOOST': {
            let cost = 0;
            if (action.type === 'BUY_REVIVE') cost = C.REVIVE_COST;
            else if (action.type === 'BUY_FAST_RELOAD') cost = C.FAST_RELOAD_COST;
            else if (action.type === 'BUY_RAPID_FIRE') cost = C.RAPID_FIRE_COST;
            else if (action.type === 'BUY_SPEED_BOOST') cost = C.SPEED_BOOST_COST;
            
            const currentProgression = getProgressionFromState(state);
            const availableCurrency = (state.status === GameStatus.Intermission ? state.currencyEarnedThisRun : 0) + currentProgression.totalCurrency;
            
            if (availableCurrency < cost) return state;

            const newProgression = { ...currentProgression };
            let newCurrencyEarnedThisRun = state.currencyEarnedThisRun;

            if (state.status === GameStatus.Intermission) {
                if (newCurrencyEarnedThisRun >= cost) {
                    newCurrencyEarnedThisRun -= cost;
                } else {
                    const remainingCost = cost - newCurrencyEarnedThisRun;
                    newCurrencyEarnedThisRun = 0;
                    newProgression.totalCurrency -= remainingCost;
                }
            } else {
                newProgression.totalCurrency -= cost;
            }
            
            if (action.type === 'BUY_REVIVE') newProgression.ownedRevives++;
            else if (action.type === 'BUY_FAST_RELOAD') newProgression.ownedFastReloads++;
            else if (action.type === 'BUY_RAPID_FIRE') newProgression.ownedRapidFires++;
            else if (action.type === 'BUY_SPEED_BOOST') newProgression.ownedSpeedBoosts++;
            
            saveProgression(newProgression);
            const { seenEnemies, ...progressionToApply } = newProgression;
            
            return {
                ...state,
                ...progressionToApply,
                currencyEarnedThisRun: newCurrencyEarnedThisRun,
                seenEnemies: new Set(newProgression.seenEnemies),
            };
        }
        case 'BUY_CONSUMABLE_WITH_CRYSTALITE': {
            let cost = 0;
            switch (action.item) {
                case 'revive': cost = C.CRYSTALITE_COST_REVIVE; break;
                case 'fastReload': cost = C.CRYSTALITE_COST_FAST_RELOAD; break;
                case 'rapidFire': cost = C.CRYSTALITE_COST_RAPID_FIRE; break;
                case 'speedBoost': cost = C.CRYSTALITE_COST_SPEED_BOOST; break;
                default: return state;
            }

            if (state.crystalite < cost) return state;

            const currentProgression = getProgressionFromState(state);
            currentProgression.crystalite -= cost;

            switch (action.item) {
                case 'revive': currentProgression.ownedRevives++; break;
                case 'fastReload': currentProgression.ownedFastReloads++; break;
                case 'rapidFire': currentProgression.ownedRapidFires++; break;
                case 'speedBoost': currentProgression.ownedSpeedBoosts++; break;
            }

            saveProgression(currentProgression);
            const { seenEnemies, ...progressionToApply } = currentProgression;
            
            return {
                ...state,
                ...progressionToApply,
                seenEnemies: new Set(currentProgression.seenEnemies),
            };
        }

        default:
            return state;
    }
}