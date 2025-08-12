import React, { useState, useEffect } from 'react';
import { playSound } from '../../sounds';
import { HeroType, HeroUpgrades, OngoingUpgrade, HeroUpgradeKey, GeneralUpgrades, GeneralUpgradeKey, UpgradeConfig } from '../../types';
import * as C from '../../constants';
import { ScreenOverlay, CurrencyIcon, UpgradePartIcon, formatTime, CountdownTimer, AnimatedNumber } from './shared';
import { HangarUpgradeAnimation } from './HangarUpgradeAnimation';

const AlphaPreview: React.FC = () => <div className="w-full h-full bg-slate-700" style={{ clipPath: 'polygon(50% 0, 100% 75%, 80% 100%, 20% 100%, 0 75%)' }}/>
const BetaPreview: React.FC = () => <div className="w-full h-full bg-slate-700" style={{ clipPath: 'polygon(50% 0, 70% 90%, 50% 100%, 30% 90%)' }}/>
const GammaPreview: React.FC = () => <div className="w-full h-full bg-slate-700" style={{ clipPath: 'polygon(50% 0, 100% 40%, 85% 100%, 15% 100%, 0 40%)' }}/>

const heroPreviews: Record<HeroType, { component: React.FC; name: string; }> = {
    alpha: { component: AlphaPreview, name: 'Alpha' },
    beta: { component: BetaPreview, name: 'Beta' },
    gamma: { component: GammaPreview, name: 'Gamma' },
};


interface HangarScreenProps {
    onReturnToMenu: () => void;
    onStartUpgrade: (target: HeroType | 'general', upgradeKey: string, level: number) => void;
    onCollectUpgrade: () => void;
    totalCurrency: number;
    upgradeParts: number;
    heroUpgrades: HeroUpgrades;
    generalUpgrades: GeneralUpgrades;
    ongoingUpgrade: OngoingUpgrade | null;
    unlockedHeroes: { beta: boolean; gamma: boolean; };
    unlockedTier2Upgrades: boolean;
}

const heroUpgradeDetails: Record<HeroType, { name: string, type: HeroUpgradeKey, description: string, config: UpgradeConfig[], level: (u: HeroUpgrades) => number, effectText: (lvl: number) => string}> = {
    alpha: { 
        name: "Critical Overload",
        type: 'alpha_aoe_level',
        description: "Increases the Area of Effect radius and base Critical Hit chance.",
        config: C.HANGAR_ALPHA_UPGRADE_CONFIG,
        level: (u: HeroUpgrades) => u.alpha_aoe_level,
        effectText: (lvl: number) => {
            const config = C.HANGAR_ALPHA_UPGRADE_CONFIG[lvl-1];
            const critBonus = (config.critChanceBonus ?? 0) * 100;
            return `+${config.effect * 100}% Crit Radius, +${critBonus}% Crit Chance`;
        }
    },
    beta: {
        name: "Homing Projectiles",
        type: 'beta_homing_level',
        description: "Projectiles gain smart-tracking, gently guiding them to the nearest enemy.",
        config: C.HANGAR_BETA_UPGRADE_CONFIG,
        level: (u: HeroUpgrades) => u.beta_homing_level,
        effectText: (lvl: number) => `${Math.round(C.HANGAR_BETA_UPGRADE_CONFIG[lvl-1].effect * 100)}% Homing Strength`
    },
    gamma: {
        name: "Gigashield Plating",
        type: 'gamma_shield_hp_level',
        description: "Reinforces the shield plating and imbues it with EMP capabilities.",
        config: C.HANGAR_GAMMA_UPGRADE_CONFIG,
        level: (u: HeroUpgrades) => u.gamma_shield_hp_level,
        effectText: (lvl: number) => {
            const config = C.HANGAR_GAMMA_UPGRADE_CONFIG[lvl - 1];
            const hpText = `Shield takes ${config.effect} hits.`;

            if (lvl === 1) {
                return hpText;
            }
            if (lvl === 2) {
                return `${hpText} Gains EMP Arc ability.`;
            }
            if (lvl === 3) {
                return `${hpText} Enhances EMP Arc range & chance.`;
            }
            return hpText; // Fallback
        }
    }
};

const generalUpgradeDetails: Record<GeneralUpgradeKey, { name: string, description: string, config: UpgradeConfig[], level: (u: GeneralUpgrades) => number, effectText: (lvl: number) => string }> = {
    movement_speed_level: {
        name: "Propulsion Tuning",
        description: "Enhances engine output for superior speed and acceleration.",
        config: C.HANGAR_GENERAL_UPGRADE_CONFIG.movement_speed_level,
        level: (u: GeneralUpgrades) => u.movement_speed_level,
        effectText: (lvl: number) => `+${C.HANGAR_GENERAL_UPGRADE_CONFIG.movement_speed_level[lvl - 1].effect * 100}% Max Speed`
    },
    ammo_capacity_level: {
        name: "Magazine Injector",
        description: "Expands the ammo capacity of the main cannon.",
        config: C.HANGAR_GENERAL_UPGRADE_CONFIG.ammo_capacity_level,
        level: (u: GeneralUpgrades) => u.ammo_capacity_level,
        effectText: (lvl: number) => `+${C.HANGAR_GENERAL_UPGRADE_CONFIG.ammo_capacity_level[lvl - 1].effect} Max Ammo`
    },
    reload_speed_level: {
        name: "Reload Mechanism",
        description: "Optimizes the shell-loading mechanism for faster reloads.",
        config: C.HANGAR_GENERAL_UPGRADE_CONFIG.reload_speed_level,
        level: (u: GeneralUpgrades) => u.reload_speed_level,
        effectText: (lvl: number) => `-${C.HANGAR_GENERAL_UPGRADE_CONFIG.reload_speed_level[lvl - 1].effect * 100}% Reload Time`
    },
    trident_shot_level: {
        name: "Trident Weapon System",
        description: "Equips the ship with flanking cannons and upgrades the primary weapon.",
        config: C.HANGAR_GENERAL_UPGRADE_CONFIG.trident_shot_level,
        level: (u: GeneralUpgrades) => u.trident_shot_level,
        effectText: (lvl: number) => {
            switch (lvl) {
                case 1: return 'Flanking cannons unlocked.';
                case 2: return 'Increased fire rate for flanking cannons.';
                case 3: return 'Primary cannon fires a powerful cluster shot.';
                default: return '';
            }
        },
    },
    graviton_collector_level: {
        name: "Graviton Collector",
        description: "Generates a weak gravitational field, pulling nearby power-ups and components towards your ship.",
        config: C.HANGAR_GENERAL_UPGRADE_CONFIG.graviton_collector_level,
        level: (u: GeneralUpgrades) => u.graviton_collector_level,
        effectText: (lvl: number) => `Automatically collect resources.`
    },
};

interface UpgradeButtonProps {
    target: HeroType | 'general';
    upgradeKey: string;
    isUnlocked?: boolean;
    generalUpgrades: GeneralUpgrades;
    heroUpgrades: HeroUpgrades;
    unlockedTier2Upgrades: boolean;
    ongoingUpgrade: OngoingUpgrade | null;
    totalCurrency: number;
    upgradeParts: number;
    onStartUpgrade: (target: HeroType | 'general', upgradeKey: string, level: number) => void;
    onCollectUpgrade: () => void;
    setAnimationTrigger: (coords: { x: number; y: number } | null) => void;
}

const UpgradeButton: React.FC<UpgradeButtonProps> = ({
    target, upgradeKey, isUnlocked = true, generalUpgrades, heroUpgrades,
    unlockedTier2Upgrades, ongoingUpgrade, totalCurrency, upgradeParts,
    onStartUpgrade, onCollectUpgrade, setAnimationTrigger
}) => {
    const renderContent = (details: (typeof generalUpgradeDetails[GeneralUpgradeKey]) | (typeof heroUpgradeDetails[HeroType]), currentLevel: number) => {
        if (!isUnlocked) {
            return <div className="w-full px-4 py-3 font-bold rounded-lg bg-slate-800 text-slate-500 text-center">Hero Locked</div>;
        }
        
        let prereqMet = true;
        let prereqText = '';
        const targetLevel = currentLevel + 1;

        if (target !== 'general' && targetLevel <= details.config.length) {
            if (targetLevel === 1) {
                prereqMet = generalUpgrades.movement_speed_level > 0 ||
                            generalUpgrades.reload_speed_level > 0 ||
                            generalUpgrades.ammo_capacity_level > 0;
                prereqText = "Requires any Lvl 1 General Upgrade";
            } else {
                prereqMet = generalUpgrades.movement_speed_level >= targetLevel ||
                            generalUpgrades.reload_speed_level >= targetLevel ||
                            generalUpgrades.ammo_capacity_level >= targetLevel;
                prereqText = `Requires any Lvl ${targetLevel} General Upgrade`;
            }
        }

        if (!prereqMet) {
            return <div className="w-full px-4 py-3 font-bold rounded-lg bg-slate-800 text-slate-500 text-center text-sm">{prereqText}</div>;
        }

        if (ongoingUpgrade) {
            if (ongoingUpgrade.target === target && ongoingUpgrade.upgradeKey === upgradeKey) {
                const isComplete = Date.now() >= ongoingUpgrade.completionTime;
                if (isComplete) {
                    return (
                        <button
                            onClick={(e) => {
                                playSound('levelUp');
                                const rect = e.currentTarget.getBoundingClientRect();
                                setAnimationTrigger({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                                onCollectUpgrade();
                            }}
                            className="w-full px-4 py-3 font-bold rounded-lg shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900
                                       text-slate-900 bg-green-400 shadow-green-500/30 hover:bg-green-300 hover:shadow-lg hover:shadow-green-400/40 focus:ring-green-500"
                        >
                            Complete Upgrade
                        </button>
                    );
                }
                return (
                    <div className="w-full px-4 py-3 font-bold rounded-lg bg-slate-700 text-center">
                        <p className="text-sm text-slate-400">Installation In Progress</p>
                        <p className="text-2xl text-cyan-300"><CountdownTimer completionTime={ongoingUpgrade.completionTime} /></p>
                    </div>
                );
            } else {
                 return <div className="w-full px-4 py-3 font-bold rounded-lg bg-slate-800 text-slate-500 text-center">Another upgrade is active</div>;
            }
        }

        if (currentLevel >= details.config.length) {
            return <div className="w-full px-4 py-3 font-bold rounded-lg bg-green-800/50 text-green-300 text-center">Max Level Reached</div>;
        }

        const nextLevelConfig = details.config[currentLevel];
        const canAfford = totalCurrency >= nextLevelConfig.currency && upgradeParts >= nextLevelConfig.parts;

        return (
            <button
                onClick={() => {
                    playSound('upgradeStart');
                    onStartUpgrade(target, upgradeKey, currentLevel + 1);
                }}
                disabled={!canAfford}
                className="w-full px-4 py-3 font-bold rounded-lg shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900
                           disabled:cursor-not-allowed disabled:grayscale disabled:bg-slate-600 disabled:shadow-none disabled:text-slate-400
                           text-slate-900 bg-cyan-400 shadow-cyan-500/30 hover:bg-cyan-300 hover:shadow-lg hover:shadow-cyan-400/40 focus:ring-cyan-500"
            >
                Upgrade to Level {currentLevel + 1}
            </button>
        );
    };

    if (target === 'general') {
        const details = generalUpgradeDetails[upgradeKey as GeneralUpgradeKey];
        const currentLevel = details.level(generalUpgrades);
        if (currentLevel >= 3 && !unlockedTier2Upgrades && upgradeKey !== 'trident_shot_level' && upgradeKey !== 'graviton_collector_level') {
            return (
                <div className="w-full px-4 py-3 font-bold rounded-lg bg-slate-800 text-slate-500 text-center text-sm">
                    Unlock: Clear {C.TIER_2_UNLOCK_LEVEL_STREAK} consecutive levels
                </div>
            );
        }
        return renderContent(details, currentLevel);
    } else {
        const details = heroUpgradeDetails[target as HeroType];
        const currentLevel = details.level(heroUpgrades);
        return renderContent(details, currentLevel);
    }
};

export const HangarScreen: React.FC<HangarScreenProps> = ({
    onReturnToMenu, onStartUpgrade, onCollectUpgrade, totalCurrency, upgradeParts, heroUpgrades, generalUpgrades, ongoingUpgrade, unlockedHeroes, unlockedTier2Upgrades
}) => {
    
    const [, setTime] = useState(Date.now());
    const [animationTrigger, setAnimationTrigger] = useState<{ x: number, y: number } | null>(null);

    useEffect(() => {
        if (ongoingUpgrade) {
            const timerId = setInterval(() => {
                setTime(Date.now());
                if (Date.now() >= ongoingUpgrade.completionTime) {
                    clearInterval(timerId); 
                }
            }, 1000);
            return () => clearInterval(timerId);
        }
    }, [ongoingUpgrade]);
    
    useEffect(() => {
        if (animationTrigger) {
            const timer = setTimeout(() => setAnimationTrigger(null), 1000); // Animation duration
            return () => clearTimeout(timer);
        }
    }, [animationTrigger]);


    const heroUnlockStatus = {
        alpha: true,
        beta: unlockedHeroes.beta,
        gamma: unlockedHeroes.gamma
    };

    return (
        <ScreenOverlay className="justify-start pt-8">
            <div className="w-full h-full flex flex-col items-center">
                <h1 className="text-5xl md:text-6xl font-black uppercase tracking-widest text-cyan-300" style={{ textShadow: '0 0 15px #0ff' }}>
                    Hangar Bay
                </h1>
                <div className="mt-2 flex items-center justify-center gap-6 text-slate-300 text-xl sm:text-2xl">
                    <span className="flex items-center gap-2 text-yellow-300" title="Alien Currency">
                        <CurrencyIcon />
                        <AnimatedNumber value={totalCurrency} />
                    </span>
                    <span className="flex items-center gap-2 text-orange-400" title="Upgrade Components">
                        <UpgradePartIcon />
                        <AnimatedNumber value={upgradeParts} />
                    </span>
                </div>

                <div className="mt-6 w-full flex-grow overflow-y-auto min-h-0 p-1 pr-2 grid grid-cols-2 gap-6">
                    {/* Hero Specific Upgrades */}
                    {(Object.keys(heroPreviews) as HeroType[]).map(heroKey => {
                        const heroInfo = heroPreviews[heroKey];
                        const upgradeInfo = heroUpgradeDetails[heroKey];
                        const currentLevel = upgradeInfo.level(heroUpgrades);
                        const nextLevel = currentLevel + 1;
                        const config = upgradeInfo.config[currentLevel];
                        const isUnlocked = heroUnlockStatus[heroKey];

                        return (
                            <div key={heroKey} className="relative col-span-2 md:col-span-1 flex flex-col bg-slate-800/70 p-4 rounded-lg border border-slate-600">
                                <div className="flex items-center gap-4">
                                    <div className={`p-1 border-2 rounded-md ${isUnlocked ? 'border-cyan-500' : 'border-slate-700 grayscale'}`}>
                                        <div className="w-12 h-12">
                                            <heroInfo.component/>
                                        </div>
                                    </div>
                                    <div className="flex-grow">
                                        <h3 className="text-lg sm:text-xl font-bold text-cyan-300">{heroInfo.name}</h3>
                                        <p className="text-sm text-slate-400">{upgradeInfo.name}</p>
                                    </div>
                                </div>
                                <p className="mt-3 text-sm text-left text-slate-300 flex-grow">{upgradeInfo.description}</p>
                                {currentLevel > 0 && (
                                    <div className="mt-2 text-left">
                                        <p className="font-bold text-green-400">Current Effect:</p>
                                        <p className="text-sm text-green-300/80">{upgradeInfo.effectText(currentLevel)}</p>
                                    </div>
                                )}
                                <div className="mt-4">
                                    {isUnlocked && nextLevel <= upgradeInfo.config.length && (
                                        <div className="text-left text-sm mb-2">
                                            <p className="font-bold text-cyan-400">Next Level ({nextLevel}):</p>
                                            <p className="text-cyan-300/80">{upgradeInfo.effectText(nextLevel)}</p>
                                            <div className="flex gap-4 mt-1">
                                                <span className="text-yellow-400 flex items-center gap-1"><CurrencyIcon/> {config.currency.toLocaleString()}</span>
                                                <span className="text-orange-400 flex items-center gap-1"><UpgradePartIcon/> {config.parts.toLocaleString()}</span>
                                            </div>
                                            <p className="text-slate-400">Time: {formatTime(config.time)}</p>
                                        </div>
                                    )}
                                    <UpgradeButton
                                        target={heroKey}
                                        upgradeKey={upgradeInfo.type}
                                        isUnlocked={isUnlocked}
                                        generalUpgrades={generalUpgrades}
                                        heroUpgrades={heroUpgrades}
                                        unlockedTier2Upgrades={unlockedTier2Upgrades}
                                        ongoingUpgrade={ongoingUpgrade}
                                        totalCurrency={totalCurrency}
                                        upgradeParts={upgradeParts}
                                        onStartUpgrade={onStartUpgrade}
                                        onCollectUpgrade={onCollectUpgrade}
                                        setAnimationTrigger={setAnimationTrigger}
                                    />
                                </div>
                            </div>
                        )
                    })}

                     {/* General Upgrades */}
                    <div className="col-span-2">
                        <h2 className="text-xl sm:text-2xl font-bold text-cyan-300 mb-2 mt-4 text-center">General Ship Upgrades</h2>
                    </div>

                    {(Object.keys(generalUpgradeDetails) as GeneralUpgradeKey[]).map(upgradeKey => {
                        const upgradeInfo = generalUpgradeDetails[upgradeKey];

                        if (upgradeKey === 'trident_shot_level' && !generalUpgrades.trident_shot_unlocked) {
                            return null;
                        }

                        const currentLevel = upgradeInfo.level(generalUpgrades);
                        const nextLevel = currentLevel + 1;
                        const config = upgradeInfo.config[currentLevel];
                        const isSpecial = upgradeKey === 'trident_shot_level' || upgradeKey === 'graviton_collector_level';
                        const isTier2 = currentLevel >= 3 && !isSpecial;

                        return (
                            <div key={upgradeKey} className={`relative col-span-2 md:col-span-1 flex flex-col bg-slate-800/70 p-4 rounded-lg border ${isSpecial ? 'border-purple-500' : (isTier2 ? 'border-yellow-500' : 'border-slate-600')}`}>
                                 <h3 className={`text-lg sm:text-xl font-bold ${isSpecial ? 'text-purple-300' : 'text-cyan-300'}`}>{upgradeInfo.name}</h3>
                                 <p className="mt-1 text-sm text-left text-slate-300 flex-grow">{upgradeInfo.description}</p>
                                 {currentLevel > 0 && (
                                    <div className="mt-2 text-left">
                                        <p className="font-bold text-green-400">Current Effect:</p>
                                        <p className="text-sm text-green-300/80">{upgradeInfo.effectText(currentLevel)}</p>
                                    </div>
                                )}
                                 <div className="mt-4">
                                    {nextLevel <= upgradeInfo.config.length && (
                                        <div className="text-left text-sm mb-2">
                                            <p className={`font-bold ${isSpecial ? 'text-purple-400' : (isTier2 ? 'text-yellow-400' : 'text-cyan-400')}`}>Next Level ({nextLevel}):</p>
                                            <p className={`${isSpecial ? 'text-purple-300/80' : (isTier2 ? 'text-yellow-300/80' : 'text-cyan-300/80')}`}>{upgradeInfo.effectText(nextLevel)}</p>
                                            <div className="flex gap-4 mt-1">
                                                <span className="text-yellow-400 flex items-center gap-1"><CurrencyIcon/> {config.currency.toLocaleString()}</span>
                                                <span className="text-orange-400 flex items-center gap-1"><UpgradePartIcon/> {config.parts.toLocaleString()}</span>
                                            </div>
                                            <p className="text-slate-400">Time: {formatTime(config.time)}</p>
                                        </div>
                                    )}
                                    <UpgradeButton
                                        target="general"
                                        upgradeKey={upgradeKey}
                                        generalUpgrades={generalUpgrades}
                                        heroUpgrades={heroUpgrades}
                                        unlockedTier2Upgrades={unlockedTier2Upgrades}
                                        ongoingUpgrade={ongoingUpgrade}
                                        totalCurrency={totalCurrency}
                                        upgradeParts={upgradeParts}
                                        onStartUpgrade={onStartUpgrade}
                                        onCollectUpgrade={onCollectUpgrade}
                                        setAnimationTrigger={setAnimationTrigger}
                                    />
                                 </div>
                            </div>
                        )
                    })}

                </div>

                <button
                  onClick={() => {
                    playSound('uiClick');
                    onReturnToMenu();
                  }}
                  className="my-6 px-8 py-4 text-lg sm:text-xl font-bold text-white bg-slate-700 rounded-lg shadow-lg shadow-slate-800/30 transition-all
                             hover:bg-slate-600 hover:shadow-xl hover:shadow-slate-700/50 focus:outline-none focus:ring-4 focus:ring-slate-500 transform hover:scale-105"
                >
                  Back to Menu
                </button>
            </div>
            {animationTrigger && <HangarUpgradeAnimation x={animationTrigger.x} y={animationTrigger.y} />}
        </ScreenOverlay>
    );
};
