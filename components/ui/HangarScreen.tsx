import React, { useEffect, useState } from 'react';
import {
    ArrowLeft,
    Boxes,
    Check,
    CheckCircle2,
    Clock3,
    Crosshair,
    Gauge,
    LockKeyhole,
    Orbit,
    RefreshCw,
    Rocket,
    Sparkles,
    Timer,
    Wrench,
} from 'lucide-react';
import { playSound } from '../../sounds';
import {
    HeroType,
    HeroUpgrades,
    OngoingUpgrade,
    HeroUpgradeKey,
    GeneralUpgrades,
    GeneralUpgradeKey,
    UpgradeConfig,
    GameAction,
} from '../../types';
import * as C from '../../constants';
import {
    AnimatedNumber,
    Badge,
    CountdownTimer,
    CrystaliteIcon,
    CurrencyChip,
    CurrencyIcon,
    GlassPanel,
    NeonButton,
    ScreenShell,
    UpgradePartIcon,
    formatTime,
} from './shared';
import { HeroPreviewCanvas } from './HeroPreviewCanvas';
import { HangarUpgradeAnimation } from './HangarUpgradeAnimation';

const heroPreviews: Record<HeroType, { name: string }> = {
    alpha: { name: 'Alpha' },
    beta: { name: 'Beta' },
    gamma: { name: 'Gamma' },
};

interface HangarScreenProps {
    dispatch: React.Dispatch<GameAction>;
    totalCurrency: number;
    crystalite: number;
    upgradeParts: number;
    heroUpgrades: HeroUpgrades;
    generalUpgrades: GeneralUpgrades;
    ongoingUpgrade: OngoingUpgrade | null;
    unlockedHeroes: { beta: boolean; gamma: boolean };
    unlockedTier2Upgrades: boolean;
}

const heroUpgradeDetails: Record<HeroType, {
    name: string;
    type: HeroUpgradeKey;
    description: string;
    config: UpgradeConfig[];
    level: (upgrades: HeroUpgrades) => number;
    effectText: (level: number) => string;
}> = {
    alpha: {
        name: 'Critical Overload',
        type: 'alpha_aoe_level',
        description: 'Increases the Area of Effect radius and base Critical Hit chance.',
        config: C.HANGAR_ALPHA_UPGRADE_CONFIG,
        level: upgrades => upgrades.alpha_aoe_level,
        effectText: level => {
            const config = C.HANGAR_ALPHA_UPGRADE_CONFIG[level - 1];
            const critBonus = (config.critChanceBonus ?? 0) * 100;
            let text = `+${config.effect * 100}% Crit Radius, +${critBonus}% Crit Chance`;
            if (level === 3) text += '. Main cannon permanently empowered.';
            return text;
        },
    },
    beta: {
        name: 'Homing Projectiles',
        type: 'beta_homing_level',
        description: 'Projectiles gain smart-tracking, gently guiding them to the nearest enemy.',
        config: C.HANGAR_BETA_UPGRADE_CONFIG,
        level: upgrades => upgrades.beta_homing_level,
        effectText: level => {
            let text = `${Math.round(C.HANGAR_BETA_UPGRADE_CONFIG[level - 1].effect * 100)}% Homing Strength`;
            if (level === 3) text += '. Unlocks Phase Shift ability.';
            return text;
        },
    },
    gamma: {
        name: 'Gigashield Plating',
        type: 'gamma_shield_hp_level',
        description: 'Reinforces the shield plating and imbues it with EMP capabilities.',
        config: C.HANGAR_GAMMA_UPGRADE_CONFIG,
        level: upgrades => upgrades.gamma_shield_hp_level,
        effectText: level => {
            const config = C.HANGAR_GAMMA_UPGRADE_CONFIG[level - 1];
            const hpText = `Shield takes ${config.effect} hits.`;
            if (level === 1) return hpText;
            if (level === 2) return `${hpText} Gains EMP Arc ability.`;
            if (level === 3) return `${hpText} Enhances EMP Arc range & chance.`;
            return hpText;
        },
    },
};

const generalUpgradeDetails: Record<GeneralUpgradeKey, {
    name: string;
    description: string;
    config: UpgradeConfig[];
    level: (upgrades: GeneralUpgrades) => number;
    effectText: (level: number) => string;
}> = {
    movement_speed_level: {
        name: 'Propulsion Tuning',
        description: 'Enhances engine output for superior speed and acceleration.',
        config: C.HANGAR_GENERAL_UPGRADE_CONFIG.movement_speed_level,
        level: upgrades => upgrades.movement_speed_level,
        effectText: level => `+${C.HANGAR_GENERAL_UPGRADE_CONFIG.movement_speed_level[level - 1].effect * 100}% Max Speed`,
    },
    ammo_capacity_level: {
        name: 'Magazine Injector',
        description: 'Expands the ammo capacity of the main cannon.',
        config: C.HANGAR_GENERAL_UPGRADE_CONFIG.ammo_capacity_level,
        level: upgrades => upgrades.ammo_capacity_level,
        effectText: level => `+${C.HANGAR_GENERAL_UPGRADE_CONFIG.ammo_capacity_level[level - 1].effect} Max Ammo`,
    },
    reload_speed_level: {
        name: 'Reload Mechanism',
        description: 'Optimizes the shell-loading mechanism for faster reloads.',
        config: C.HANGAR_GENERAL_UPGRADE_CONFIG.reload_speed_level,
        level: upgrades => upgrades.reload_speed_level,
        effectText: level => `-${C.HANGAR_GENERAL_UPGRADE_CONFIG.reload_speed_level[level - 1].effect * 100}% Reload Time`,
    },
    trident_shot_level: {
        name: 'Trident Weapon System',
        description: 'Equips the ship with flanking cannons and upgrades the primary weapon.',
        config: C.HANGAR_GENERAL_UPGRADE_CONFIG.trident_shot_level,
        level: upgrades => upgrades.trident_shot_level,
        effectText: level => {
            switch (level) {
                case 1: return 'Flanking cannons unlocked.';
                case 2: return 'Increased fire rate for flanking cannons.';
                case 3: return 'Primary cannon fires a powerful cluster shot.';
                default: return '';
            }
        },
    },
    graviton_collector_level: {
        name: 'Graviton Collector',
        description: 'Generates a weak gravitational field, pulling nearby power-ups and components towards your ship.',
        config: C.HANGAR_GENERAL_UPGRADE_CONFIG.graviton_collector_level,
        level: upgrades => upgrades.graviton_collector_level,
        effectText: _level => 'Automatically collect resources.',
    },
};

const GENERAL_UPGRADE_ICONS: Record<GeneralUpgradeKey, React.ReactNode> = {
    movement_speed_level: <Gauge className="h-6 w-6" />,
    ammo_capacity_level: <Boxes className="h-6 w-6" />,
    reload_speed_level: <RefreshCw className="h-6 w-6" />,
    trident_shot_level: <Crosshair className="h-6 w-6" />,
    graviton_collector_level: <Orbit className="h-6 w-6" />,
};

type UpgradePathTone = 'cyan' | 'violet' | 'gold';

const PATH_STYLES: Record<UpgradePathTone, {
    completeNode: string;
    nextNode: string;
    completeLine: string;
    label: string;
}> = {
    cyan: {
        completeNode: 'border-cyan-200 bg-cyan-400 text-slate-950 shadow-neon-cyan',
        nextNode: 'border-cyan-300 bg-cyan-400/15 text-cyan-100',
        completeLine: 'bg-cyan-400/70',
        label: 'text-cyan-300',
    },
    violet: {
        completeNode: 'border-violet-200 bg-violet-400 text-slate-950 shadow-neon-violet',
        nextNode: 'border-violet-300 bg-violet-400/15 text-violet-100',
        completeLine: 'bg-violet-400/70',
        label: 'text-violet-300',
    },
    gold: {
        completeNode: 'border-yellow-200 bg-yellow-300 text-slate-950 shadow-[0_0_16px_rgba(250,204,21,0.25)]',
        nextNode: 'border-yellow-300 bg-yellow-300/15 text-yellow-100',
        completeLine: 'bg-yellow-300/70',
        label: 'text-yellow-300',
    },
};

interface UpgradePathProps {
    currentLevel: number;
    totalLevels: number;
    tone?: UpgradePathTone;
    locked?: boolean;
}

const UpgradePath: React.FC<UpgradePathProps> = ({
    currentLevel,
    totalLevels,
    tone = 'cyan',
    locked = false,
}) => {
    const style = PATH_STYLES[tone];

    return (
        <div className="mt-3" aria-label={`Upgrade progress: level ${currentLevel} of ${totalLevels}`}>
            <div className="flex w-full items-center" aria-hidden="true">
                {Array.from({ length: totalLevels }, (_, index) => {
                    const level = index + 1;
                    const complete = !locked && currentLevel >= level;
                    const next = !locked && currentLevel + 1 === level;
                    const connectorComplete = !locked && currentLevel >= level;
                    return (
                        <React.Fragment key={level}>
                            {index > 0 && (
                                <span className={`h-0.5 min-w-2 flex-1 ${connectorComplete ? style.completeLine : 'bg-slate-700'}`} />
                            )}
                            <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-black ${
                                    complete
                                        ? style.completeNode
                                        : next
                                            ? style.nextNode
                                            : 'border-slate-600 bg-slate-900 text-slate-500'
                                }`}
                            >
                                {complete ? <Check className="h-3.5 w-3.5" /> : level}
                            </span>
                        </React.Fragment>
                    );
                })}
            </div>
            <div className="mt-1 flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-slate-500">
                <span>Base</span>
                <span className={style.label}>Level {Math.min(currentLevel + 1, totalLevels)}</span>
                <span>Max</span>
            </div>
        </div>
    );
};

const UpgradeActionStatus: React.FC<{
    icon: React.ReactNode;
    children: React.ReactNode;
    tone?: 'neutral' | 'lime' | 'gold';
}> = ({ icon, children, tone = 'neutral' }) => {
    const toneClass = tone === 'lime'
        ? 'border-lime-400/25 bg-lime-950/35 text-lime-200'
        : tone === 'gold'
            ? 'border-yellow-400/25 bg-yellow-950/30 text-yellow-200'
            : 'border-slate-600/70 bg-slate-950/55 text-slate-400';

    return (
        <div className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-center text-xs font-bold ${toneClass}`} role="status">
            <span className="shrink-0" aria-hidden="true">{icon}</span>
            <span>{children}</span>
        </div>
    );
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
    crystalite: number;
    upgradeParts: number;
    dispatch: React.Dispatch<GameAction>;
    setAnimationTrigger: (coords: { x: number; y: number } | null) => void;
}

const UpgradeButton: React.FC<UpgradeButtonProps> = ({
    target,
    upgradeKey,
    isUnlocked = true,
    generalUpgrades,
    heroUpgrades,
    unlockedTier2Upgrades,
    ongoingUpgrade,
    totalCurrency,
    crystalite,
    upgradeParts,
    dispatch,
    setAnimationTrigger,
}) => {
    const renderContent = (
        details: (typeof generalUpgradeDetails)[GeneralUpgradeKey] | (typeof heroUpgradeDetails)[HeroType],
        currentLevel: number,
    ) => {
        if (!isUnlocked) {
            return <UpgradeActionStatus icon={<LockKeyhole className="h-4 w-4" />}>Hero Locked</UpgradeActionStatus>;
        }

        let prereqMet = true;
        let prereqText = '';
        const targetLevel = currentLevel + 1;

        if (target !== 'general') {
            if (targetLevel <= details.config.length) {
                if (targetLevel === 1) {
                    prereqMet = generalUpgrades.movement_speed_level > 0
                        || generalUpgrades.reload_speed_level > 0
                        || generalUpgrades.ammo_capacity_level > 0;
                    prereqText = 'Requires any Lvl 1 General Upgrade';
                } else {
                    prereqMet = generalUpgrades.movement_speed_level >= targetLevel
                        || generalUpgrades.reload_speed_level >= targetLevel
                        || generalUpgrades.ammo_capacity_level >= targetLevel;
                    prereqText = `Requires any Lvl ${targetLevel} General Upgrade`;
                }
            }
        } else if ((upgradeKey === 'trident_shot_level' || upgradeKey === 'graviton_collector_level') && targetLevel === 1) {
            prereqMet = generalUpgrades.movement_speed_level >= 3
                || generalUpgrades.reload_speed_level >= 3
                || generalUpgrades.ammo_capacity_level >= 3;
            prereqText = 'Requires any Lvl 3 General Upgrade';
        }

        if (!prereqMet) {
            return <UpgradeActionStatus icon={<LockKeyhole className="h-4 w-4" />}>{prereqText}</UpgradeActionStatus>;
        }

        if (ongoingUpgrade) {
            if (ongoingUpgrade.target === target && ongoingUpgrade.upgradeKey === upgradeKey) {
                const isComplete = Date.now() >= ongoingUpgrade.completionTime;
                if (isComplete) {
                    return (
                        <NeonButton
                            fullWidth
                            className="border-lime-300/50 bg-lime-400 text-slate-950 hover:bg-lime-300"
                            icon={<CheckCircle2 className="h-5 w-5" />}
                            onClick={event => {
                                playSound('levelUp');
                                const rect = event.currentTarget.getBoundingClientRect();
                                setAnimationTrigger({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
                                dispatch({ type: 'COLLECT_UPGRADE' });
                            }}
                        >
                            Complete Upgrade
                        </NeonButton>
                    );
                }

                const remainingTime = Math.max(0, ongoingUpgrade.completionTime - Date.now());
                const instaFinishCost = 10 + Math.ceil(remainingTime / (1000 * 60 * 2));

                return (
                    <div className="w-full border-t border-cyan-400/20 pt-3 text-center">
                        <div className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider text-cyan-300">
                            <Timer className="h-4 w-4" aria-hidden="true" />
                            Installation In Progress
                        </div>
                        <p className="mt-1 font-mono text-2xl font-black tabular-nums text-cyan-100" aria-label="Time remaining">
                            <CountdownTimer completionTime={ongoingUpgrade.completionTime} />
                        </p>
                        <NeonButton
                            variant="quiet"
                            fullWidth
                            className="mt-2 border-violet-300/35 text-violet-100"
                            icon={<Sparkles className="h-4 w-4" />}
                            onClick={() => {
                                playSound('purchase');
                                dispatch({ type: 'INSTA_FINISH_UPGRADE', cost: instaFinishCost });
                            }}
                            disabled={crystalite < instaFinishCost}
                            aria-label={`Finish upgrade now for ${instaFinishCost} Crystalite`}
                        >
                            Finish Now - {instaFinishCost} <CrystaliteIcon className="inline h-4 w-4" />
                        </NeonButton>
                    </div>
                );
            }

            return <UpgradeActionStatus icon={<Clock3 className="h-4 w-4" />}>Another upgrade is active</UpgradeActionStatus>;
        }

        if (currentLevel >= details.config.length) {
            return <UpgradeActionStatus tone="lime" icon={<CheckCircle2 className="h-4 w-4" />}>Max Level Reached</UpgradeActionStatus>;
        }

        const nextLevelConfig = details.config[currentLevel];
        const canAfford = totalCurrency >= nextLevelConfig.currency && upgradeParts >= nextLevelConfig.parts;
        const crystaliteCost = Math.ceil((nextLevelConfig.currency / 400) + (nextLevelConfig.parts * 5));
        const canAffordCrystalite = crystalite >= crystaliteCost;

        return (
            <div className="flex flex-col gap-2">
                <NeonButton
                    fullWidth
                    icon={<Wrench className="h-4 w-4" />}
                    onClick={() => {
                        playSound('upgradeStart');
                        dispatch({ type: 'START_UPGRADE', target, upgradeKey, level: currentLevel + 1 });
                    }}
                    disabled={!canAfford}
                >
                    Install Level {currentLevel + 1}
                </NeonButton>
                <NeonButton
                    variant="quiet"
                    fullWidth
                    className="border-violet-300/35 text-violet-100"
                    icon={<Sparkles className="h-4 w-4" />}
                    onClick={() => {
                        playSound('purchase');
                        dispatch({ type: 'BUY_UPGRADE_WITH_CRYSTALITE', target, upgradeKey });
                    }}
                    disabled={!canAffordCrystalite}
                    aria-label={`Buy and finish level ${currentLevel + 1} for ${crystaliteCost} Crystalite`}
                >
                    Instant - {crystaliteCost} <CrystaliteIcon className="inline h-4 w-4" />
                </NeonButton>
            </div>
        );
    };

    if (target === 'general') {
        const details = generalUpgradeDetails[upgradeKey as GeneralUpgradeKey];
        const currentLevel = details.level(generalUpgrades);
        if (
            currentLevel >= 3
            && !unlockedTier2Upgrades
            && upgradeKey !== 'trident_shot_level'
            && upgradeKey !== 'graviton_collector_level'
        ) {
            return (
                <UpgradeActionStatus tone="gold" icon={<LockKeyhole className="h-4 w-4" />}>
                    Unlock: Clear {C.TIER_2_UNLOCK_LEVEL_STREAK} consecutive levels
                </UpgradeActionStatus>
            );
        }
        return renderContent(details, currentLevel);
    }

    const details = heroUpgradeDetails[target];
    const currentLevel = details.level(heroUpgrades);
    return renderContent(details, currentLevel);
};

export const HangarScreen: React.FC<HangarScreenProps> = ({
    dispatch,
    totalCurrency,
    crystalite,
    upgradeParts,
    heroUpgrades,
    generalUpgrades,
    ongoingUpgrade,
    unlockedHeroes,
    unlockedTier2Upgrades,
}) => {
    const [, setTime] = useState(Date.now());
    const [animationTrigger, setAnimationTrigger] = useState<{ x: number; y: number } | null>(null);

    useEffect(() => {
        if (!ongoingUpgrade) return undefined;

        const timerId = window.setInterval(() => {
            setTime(Date.now());
            if (Date.now() >= ongoingUpgrade.completionTime) window.clearInterval(timerId);
        }, 1000);

        return () => window.clearInterval(timerId);
    }, [ongoingUpgrade]);

    useEffect(() => {
        if (!animationTrigger) return undefined;
        const timer = window.setTimeout(() => setAnimationTrigger(null), 1000);
        return () => window.clearTimeout(timer);
    }, [animationTrigger]);

    const heroUnlockStatus: Record<HeroType, boolean> = {
        alpha: true,
        beta: unlockedHeroes.beta,
        gamma: unlockedHeroes.gamma,
    };

    const titleId = 'hangar-screen-title';

    return (
        <ScreenShell titleId={titleId} contentClassName="py-2 sm:py-5">
            <main className="flex w-full max-w-6xl flex-col items-center pb-2 text-center">
                <header className="w-full shrink-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-400/80">Fleet Engineering</p>
                    <h1 id={titleId} className="neon-title mt-1 text-3xl font-black uppercase sm:text-4xl">Hangar Bay</h1>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                        <CurrencyChip
                            icon={<CurrencyIcon className="h-5 w-5" />}
                            label="Alien Currency"
                            value={<AnimatedNumber value={totalCurrency} />}
                            tone="gold"
                        />
                        <CurrencyChip
                            icon={<UpgradePartIcon className="h-5 w-5" />}
                            label="Upgrade Components"
                            value={<AnimatedNumber value={upgradeParts} />}
                            tone="danger"
                        />
                        <CurrencyChip
                            icon={<CrystaliteIcon className="h-5 w-5" />}
                            label="Crystalite"
                            value={<AnimatedNumber value={crystalite} />}
                            tone="violet"
                        />
                    </div>
                    <div className="mt-2 flex min-h-6 items-center justify-center">
                        {ongoingUpgrade ? (
                            <Badge tone="cyan" pulse>
                                <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                                Installation Queue Active
                            </Badge>
                        ) : (
                            <Badge tone="neutral">Installation Bay Ready</Badge>
                        )}
                    </div>
                </header>

                <section className="mt-5 w-full text-left" aria-labelledby="general-upgrades-title">
                    <div className="flex flex-wrap items-end justify-between gap-2 border-b border-cyan-400/20 pb-2">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Primary Path</p>
                            <h2 id="general-upgrades-title" className="text-xl font-black uppercase text-cyan-100">General Ship Systems</h2>
                        </div>
                        <p className="max-w-md text-xs text-slate-400">Core system levels unlock frame-specific engineering and advanced systems.</p>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        {(Object.keys(generalUpgradeDetails) as GeneralUpgradeKey[]).map(upgradeKey => {
                            const upgradeInfo = generalUpgradeDetails[upgradeKey];

                            if (upgradeKey === 'trident_shot_level' && !generalUpgrades.trident_shot_unlocked) return null;

                            const currentLevel = upgradeInfo.level(generalUpgrades);
                            const nextLevel = currentLevel + 1;
                            const config = upgradeInfo.config[currentLevel];
                            const isSpecial = upgradeKey === 'trident_shot_level' || upgradeKey === 'graviton_collector_level';
                            const isTier2 = currentLevel >= 3 && !isSpecial;
                            const tone = isSpecial ? 'violet' : isTier2 ? 'gold' : 'cyan';
                            const titleClass = isSpecial
                                ? 'text-violet-100'
                                : isTier2
                                    ? 'text-yellow-100'
                                    : 'text-cyan-100';
                            const iconClass = isSpecial
                                ? 'border-violet-300/30 bg-violet-400/10 text-violet-200'
                                : isTier2
                                    ? 'border-yellow-300/30 bg-yellow-300/10 text-yellow-200'
                                    : 'border-cyan-300/30 bg-cyan-400/10 text-cyan-200';

                            return (
                                <GlassPanel key={upgradeKey} tone={tone} interactive className="flex flex-col p-4">
                                    <div className="flex items-start gap-3">
                                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border ${iconClass}`} aria-hidden="true">
                                            {GENERAL_UPGRADE_ICONS[upgradeKey]}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <h3 className={`text-base font-black uppercase sm:text-lg ${titleClass}`}>{upgradeInfo.name}</h3>
                                                <Badge tone={isSpecial ? 'violet' : isTier2 ? 'gold' : 'cyan'}>
                                                    Level {currentLevel}/{upgradeInfo.config.length}
                                                </Badge>
                                            </div>
                                            <p className="mt-1 text-sm leading-snug text-slate-300">{upgradeInfo.description}</p>
                                        </div>
                                    </div>

                                    <UpgradePath currentLevel={currentLevel} totalLevels={upgradeInfo.config.length} tone={tone} />

                                    {currentLevel > 0 && (
                                        <div className="mt-3 border-l-2 border-lime-400/40 pl-3">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-lime-300">Current Effect</p>
                                            <p className="mt-0.5 text-xs leading-snug text-lime-100/80">{upgradeInfo.effectText(currentLevel)}</p>
                                        </div>
                                    )}

                                    <div className="mt-auto pt-3">
                                        {nextLevel <= upgradeInfo.config.length && (
                                            <div className="mb-3 border-t border-slate-700/70 pt-3">
                                                <p className={`text-xs font-black uppercase ${titleClass}`}>Level {nextLevel} Output</p>
                                                <p className="mt-0.5 text-xs leading-snug text-slate-300">{upgradeInfo.effectText(nextLevel)}</p>
                                                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold">
                                                    <span className="flex items-center gap-1 text-yellow-200">
                                                        <CurrencyIcon className="h-4 w-4" /> {config.currency.toLocaleString()}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-orange-300">
                                                        <UpgradePartIcon className="h-4 w-4" /> {config.parts.toLocaleString()}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-slate-400">
                                                        <Clock3 className="h-4 w-4" /> {formatTime(config.time)}
                                                    </span>
                                                </div>
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
                                            crystalite={crystalite}
                                            upgradeParts={upgradeParts}
                                            dispatch={dispatch}
                                            setAnimationTrigger={setAnimationTrigger}
                                        />
                                    </div>
                                </GlassPanel>
                            );
                        })}
                    </div>
                </section>

                <div className="my-5 flex w-full items-center gap-3 text-cyan-400/60" aria-hidden="true">
                    <span className="h-px flex-1 bg-cyan-400/20" />
                    <Rocket className="h-5 w-5" />
                    <span className="h-px flex-1 bg-cyan-400/20" />
                </div>

                <section className="w-full text-left" aria-labelledby="frame-upgrades-title">
                    <div className="flex flex-wrap items-end justify-between gap-2 border-b border-violet-400/20 pb-2">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-300">Specialization Path</p>
                            <h2 id="frame-upgrades-title" className="text-xl font-black uppercase text-violet-100">Hero Frames</h2>
                        </div>
                        <p className="max-w-md text-xs text-slate-400">Each frame advances only when its matching general-system prerequisite is online.</p>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {(Object.keys(heroPreviews) as HeroType[]).map(heroKey => {
                            const heroInfo = heroPreviews[heroKey];
                            const upgradeInfo = heroUpgradeDetails[heroKey];
                            const currentLevel = upgradeInfo.level(heroUpgrades);
                            const nextLevel = currentLevel + 1;
                            const config = upgradeInfo.config[currentLevel];
                            const isUnlocked = heroUnlockStatus[heroKey];

                            return (
                                <GlassPanel key={heroKey} tone={isUnlocked ? 'violet' : 'neutral'} interactive={isUnlocked} className="flex flex-col p-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-20 w-24 shrink-0 overflow-hidden rounded-md border bg-slate-950/60 ${isUnlocked ? 'border-violet-300/35' : 'border-slate-700'}`}>
                                            <HeroPreviewCanvas
                                                hero={heroKey}
                                                selected={isUnlocked && ongoingUpgrade?.target === heroKey}
                                                locked={!isUnlocked}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="text-lg font-black uppercase text-violet-100">{heroInfo.name}</h3>
                                                {!isUnlocked && (
                                                    <Badge tone="neutral">
                                                        <LockKeyhole className="h-3 w-3" aria-hidden="true" /> Locked
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="mt-0.5 text-sm font-bold text-slate-300">{upgradeInfo.name}</p>
                                            <Badge tone={isUnlocked ? 'violet' : 'neutral'} className="mt-1">
                                                Level {currentLevel}/{upgradeInfo.config.length}
                                            </Badge>
                                        </div>
                                    </div>

                                    <p className="mt-3 text-sm leading-snug text-slate-300">{upgradeInfo.description}</p>
                                    <UpgradePath currentLevel={currentLevel} totalLevels={upgradeInfo.config.length} tone="violet" locked={!isUnlocked} />

                                    {currentLevel > 0 && (
                                        <div className="mt-3 border-l-2 border-lime-400/40 pl-3">
                                            <p className="text-[10px] font-black uppercase tracking-wider text-lime-300">Current Effect</p>
                                            <p className="mt-0.5 text-xs leading-snug text-lime-100/80">{upgradeInfo.effectText(currentLevel)}</p>
                                        </div>
                                    )}

                                    <div className="mt-auto pt-3">
                                        {isUnlocked && nextLevel <= upgradeInfo.config.length && (
                                            <div className="mb-3 border-t border-slate-700/70 pt-3">
                                                <p className="text-xs font-black uppercase text-violet-200">Level {nextLevel} Output</p>
                                                <p className="mt-0.5 text-xs leading-snug text-slate-300">{upgradeInfo.effectText(nextLevel)}</p>
                                                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold">
                                                    <span className="flex items-center gap-1 text-yellow-200">
                                                        <CurrencyIcon className="h-4 w-4" /> {config.currency.toLocaleString()}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-orange-300">
                                                        <UpgradePartIcon className="h-4 w-4" /> {config.parts.toLocaleString()}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-slate-400">
                                                        <Clock3 className="h-4 w-4" /> {formatTime(config.time)}
                                                    </span>
                                                </div>
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
                                            crystalite={crystalite}
                                            upgradeParts={upgradeParts}
                                            dispatch={dispatch}
                                            setAnimationTrigger={setAnimationTrigger}
                                        />
                                    </div>
                                </GlassPanel>
                            );
                        })}
                    </div>
                </section>

                <footer className="mt-5 w-full max-w-sm pb-1">
                    <NeonButton
                        variant="quiet"
                        fullWidth
                        icon={<ArrowLeft className="h-5 w-5" />}
                        onClick={() => {
                            playSound('uiClick');
                            dispatch({ type: 'RETURN_TO_MENU' });
                        }}
                    >
                        Back to Menu
                    </NeonButton>
                </footer>
            </main>
            {animationTrigger && <HangarUpgradeAnimation x={animationTrigger.x} y={animationTrigger.y} />}
        </ScreenShell>
    );
};
