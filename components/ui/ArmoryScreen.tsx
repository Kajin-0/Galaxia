import React, { useState } from 'react';
import {
    ArrowLeft,
    ChevronsRight,
    HeartPulse,
    RefreshCw,
    Rocket,
    ShieldCheck,
    ShoppingCart,
    Sparkles,
    Zap,
} from 'lucide-react';
import { playSound } from '../../sounds';
import { Consumables, GameStatus, GameAction } from '../../types';
import * as C from '../../constants';
import {
    AnimatedNumber,
    Badge,
    CrystaliteIcon,
    CurrencyChip,
    CurrencyIcon,
    GlassPanel,
    NeonButton,
    ScreenShell,
    Toggle,
    UpgradePartIcon,
} from './shared';

interface ArmoryScreenProps {
    dispatch: React.Dispatch<GameAction>;
    gameStatus: GameStatus;
    totalCurrency: number;
    crystalite: number;
    currencyEarnedThisRun: number;
    partsEarnedThisRun: number;
    ownedRevives: number;
    ownedFastReloads: number;
    ownedRapidFires: number;
    ownedSpeedBoosts: number;
    intermissionReward: { name: string } | null;
    hasPermanentRapidFire?: boolean;
    hasRevive?: boolean;
}

const ITEM_STYLES = {
    revive: {
        tone: 'magenta' as const,
        title: 'text-pink-200',
        owned: 'text-pink-300/80',
    },
    fastReload: {
        tone: 'gold' as const,
        title: 'text-yellow-200',
        owned: 'text-yellow-300/80',
    },
    rapidFire: {
        tone: 'danger' as const,
        title: 'text-red-200',
        owned: 'text-red-300/80',
    },
    speedBoost: {
        tone: 'cyan' as const,
        title: 'text-cyan-200',
        owned: 'text-cyan-300/80',
    },
};

export const ArmoryScreen: React.FC<ArmoryScreenProps> = ({
    dispatch,
    gameStatus,
    totalCurrency,
    crystalite,
    currencyEarnedThisRun,
    partsEarnedThisRun,
    ownedRevives,
    ownedFastReloads,
    ownedRapidFires,
    ownedSpeedBoosts,
    intermissionReward,
    hasPermanentRapidFire,
    hasRevive,
}) => {
    const [consumables, setConsumables] = useState<Consumables>({
        useRevive: false,
        useFastReload: false,
        useRapidFire: false,
        useSpeedBoost: false,
    });

    const handleConsumableChange = (consumable: keyof Consumables, value: boolean) => {
        setConsumables(previous => ({ ...previous, [consumable]: value }));
    };

    const isIntermission = gameStatus === GameStatus.Intermission;
    const titleId = 'armory-screen-title';

    const armoryItems = [
        {
            name: C.CONSUMABLE_NAMES.revive,
            type: 'revive',
            description: 'Instantly come back to life upon death.',
            cost: C.REVIVE_COST,
            crystaliteCost: C.CRYSTALITE_COST_REVIVE,
            owned: ownedRevives,
            onBuy: () => dispatch({ type: 'BUY_REVIVE' }),
            icon: <HeartPulse className="h-7 w-7" />,
        },
        {
            name: C.CONSUMABLE_NAMES.fastReload,
            type: 'fastReload',
            description: 'Start your next run with 2 Reload Boost stacks.',
            cost: C.FAST_RELOAD_COST,
            crystaliteCost: C.CRYSTALITE_COST_FAST_RELOAD,
            owned: ownedFastReloads,
            onBuy: () => dispatch({ type: 'BUY_FAST_RELOAD' }),
            icon: <RefreshCw className="h-7 w-7" />,
        },
        {
            name: C.CONSUMABLE_NAMES.rapidFire,
            type: 'rapidFire',
            description: 'Start your next run with permanent Rapid Fire.',
            cost: C.RAPID_FIRE_COST,
            crystaliteCost: C.CRYSTALITE_COST_RAPID_FIRE,
            owned: ownedRapidFires,
            onBuy: () => dispatch({ type: 'BUY_RAPID_FIRE' }),
            icon: <Zap className="h-7 w-7" />,
        },
        {
            name: C.CONSUMABLE_NAMES.speedBoost,
            type: 'speedBoost',
            description: 'Start your next run with a 25% speed boost.',
            cost: C.SPEED_BOOST_COST,
            crystaliteCost: C.CRYSTALITE_COST_SPEED_BOOST,
            owned: ownedSpeedBoosts,
            onBuy: () => dispatch({ type: 'BUY_SPEED_BOOST' }),
            icon: <ChevronsRight className="h-7 w-7" />,
        },
    ] as const;

    const consumableChecks = [
        {
            id: 'useRevive',
            label: `Use a ${C.CONSUMABLE_NAMES.revive}`,
            owned: ownedRevives,
            tone: 'magenta' as const,
            icon: <HeartPulse className="h-5 w-5" />,
        },
        {
            id: 'useFastReload',
            label: `Use an ${C.CONSUMABLE_NAMES.fastReload}`,
            owned: ownedFastReloads,
            tone: 'gold' as const,
            icon: <RefreshCw className="h-5 w-5" />,
        },
        {
            id: 'useRapidFire',
            label: `Use an ${C.CONSUMABLE_NAMES.rapidFire}`,
            owned: ownedRapidFires,
            tone: 'danger' as const,
            icon: <Zap className="h-5 w-5" />,
        },
        {
            id: 'useSpeedBoost',
            label: `Use ${C.CONSUMABLE_NAMES.speedBoost}`,
            owned: ownedSpeedBoosts,
            tone: 'cyan' as const,
            icon: <ChevronsRight className="h-5 w-5" />,
        },
    ] as const;

    return (
        <ScreenShell titleId={titleId} contentClassName="py-2 sm:py-5">
            <main className="flex w-full max-w-3xl flex-col items-center pb-2 text-center">
                <header className="w-full shrink-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-cyan-400/80">
                        {isIntermission ? 'Sector service window' : 'Loadout supply'}
                    </p>
                    <h1 id={titleId} className="neon-title mt-1 text-3xl font-black uppercase sm:text-4xl">
                        {isIntermission ? 'Intermission' : 'Armory'}
                    </h1>
                    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                        <CurrencyChip
                            icon={<CurrencyIcon className="h-5 w-5" />}
                            label="Alien Currency"
                            value={<AnimatedNumber value={totalCurrency} />}
                            tone="gold"
                        />
                        <CurrencyChip
                            icon={<CrystaliteIcon className="h-5 w-5" />}
                            label="Crystalite"
                            value={<AnimatedNumber value={crystalite} />}
                            tone="violet"
                        />
                    </div>
                    {isIntermission && (currencyEarnedThisRun > 0 || partsEarnedThisRun > 0) && (
                        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-bold uppercase text-slate-300">
                            {currencyEarnedThisRun > 0 && (
                                <span className="flex items-center gap-1 text-yellow-200">
                                    <CurrencyIcon className="h-4 w-4" />
                                    +{currencyEarnedThisRun.toLocaleString()} this run
                                </span>
                            )}
                            {partsEarnedThisRun > 0 && (
                                <span className="flex items-center gap-1 text-orange-300">
                                    <UpgradePartIcon className="h-4 w-4" />
                                    +{partsEarnedThisRun.toLocaleString()} this run
                                </span>
                            )}
                        </div>
                    )}
                </header>

                {isIntermission && intermissionReward && (
                    <GlassPanel tone="lime" className="mt-4 w-full px-4 py-3 text-left" role="status">
                        <div className="flex items-center gap-3">
                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-lime-300/40 bg-lime-400/10 text-lime-200">
                                <Sparkles className="h-6 w-6" aria-hidden="true" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs font-black uppercase tracking-widest text-lime-300">Sector Clear Bonus</p>
                                <p className="mt-0.5 text-sm text-slate-100">
                                    Free <strong className="text-white">{intermissionReward.name}</strong> added to inventory.
                                </p>
                            </div>
                        </div>
                    </GlassPanel>
                )}

                <section aria-label="Armory inventory" className="mt-4 w-full space-y-3 text-left">
                    {armoryItems.map(item => {
                        const style = ITEM_STYLES[item.type];
                        return (
                            <GlassPanel key={item.name} tone={style.tone} interactive className="p-3 sm:p-4">
                                <div className="flex min-w-0 items-start gap-3">
                                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-current bg-slate-950/65 ${style.title}`} aria-hidden="true">
                                        {item.icon}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <h2 className={`text-base font-black uppercase sm:text-lg ${style.title}`}>{item.name}</h2>
                                            <Badge tone={style.tone}>Owned {item.owned.toLocaleString()}</Badge>
                                        </div>
                                        <p className="mt-1 text-sm leading-snug text-slate-300">{item.description}</p>
                                        <p className={`mt-1 text-xs font-bold ${style.owned}`}>Ready for next deployment</p>
                                    </div>
                                </div>
                                <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
                                    <NeonButton
                                        variant="secondary"
                                        fullWidth
                                        icon={<ShoppingCart className="h-4 w-4" />}
                                        onClick={() => {
                                            playSound('purchase');
                                            item.onBuy();
                                        }}
                                        disabled={totalCurrency < item.cost}
                                        aria-label={`Buy ${item.name} for ${item.cost.toLocaleString()} Alien Currency`}
                                    >
                                        {item.cost.toLocaleString()} <CurrencyIcon className="inline h-4 w-4" />
                                    </NeonButton>
                                    <NeonButton
                                        variant="quiet"
                                        fullWidth
                                        icon={<Sparkles className="h-4 w-4 text-violet-200" />}
                                        onClick={() => {
                                            playSound('purchase');
                                            dispatch({ type: 'BUY_CONSUMABLE_WITH_CRYSTALITE', item: item.type });
                                        }}
                                        disabled={crystalite < item.crystaliteCost}
                                        aria-label={`Buy ${item.name} for ${item.crystaliteCost} Crystalite`}
                                    >
                                        {item.crystaliteCost} <CrystaliteIcon className="inline h-4 w-4 text-violet-200" />
                                    </NeonButton>
                                </div>
                            </GlassPanel>
                        );
                    })}
                </section>

                {isIntermission && (
                    <GlassPanel tone="cyan" className="mt-4 w-full p-4 text-left">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-black uppercase tracking-widest text-cyan-400">Next Sector</p>
                                <h2 className="mt-0.5 text-lg font-black text-cyan-100">Equip Consumables</h2>
                            </div>
                            <ShieldCheck className="h-6 w-6 text-cyan-300" aria-hidden="true" />
                        </div>
                        <div className="mt-2 divide-y divide-slate-700/70">
                            {consumableChecks.map(item => {
                                const isChecked = consumables[item.id];
                                const remaining = item.owned - (isChecked ? 1 : 0);
                                const isAlreadyActive = (item.id === 'useRevive' && !!hasRevive)
                                    || (item.id === 'useRapidFire' && !!hasPermanentRapidFire);
                                const isDisabled = item.owned === 0 || isAlreadyActive;
                                const description = isAlreadyActive
                                    ? 'Already active'
                                    : `${Math.max(0, remaining)} remaining after equip`;

                                return (
                                    <Toggle
                                        key={item.id}
                                        checked={isChecked}
                                        onChange={value => handleConsumableChange(item.id, value)}
                                        disabled={isDisabled}
                                        tone={item.tone}
                                        icon={item.icon}
                                        label={item.label}
                                        description={description}
                                        className="py-2"
                                    />
                                );
                            })}
                        </div>
                    </GlassPanel>
                )}

                <footer className="mt-5 flex w-full justify-center pb-1">
                    {isIntermission ? (
                        <NeonButton
                            className="w-full sm:w-auto sm:min-w-64"
                            icon={<Rocket className="h-5 w-5" />}
                            onClick={() => {
                                playSound('uiClick');
                                dispatch({ type: 'CONTINUE_GAME', consumables });
                            }}
                        >
                            Continue Run
                        </NeonButton>
                    ) : (
                        <NeonButton
                            variant="quiet"
                            className="w-full sm:w-auto sm:min-w-56"
                            icon={<ArrowLeft className="h-5 w-5" />}
                            onClick={() => {
                                playSound('uiClick');
                                dispatch({ type: 'RETURN_TO_MENU' });
                            }}
                        >
                            Back to Menu
                        </NeonButton>
                    )}
                </footer>
            </main>
        </ScreenShell>
    );
};
