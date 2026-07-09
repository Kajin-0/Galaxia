import React, { useMemo } from 'react';
import {
    Coins,
    Eye,
    Flame,
    FlaskConical,
    HeartPulse,
    Pause,
    RotateCcw,
    Wrench,
    X,
} from 'lucide-react';
import type { GameState, GameAction, InGameMessage } from '../../types';
import { GameStatus } from '../../types';
import * as C from '../../constants';
import { getStreakBonus } from '../../utils/progression';
import { triggerHaptic } from '../../utils/haptics';
import { InGameMessageOverlay } from './InGameMessageOverlay';
import { Badge, CurrencyChip, GlassPanel, StatBar, cx } from './primitives';
import { SurvivalTimerBar } from './SurvivalTimerBar';

interface InGameHUDProps {
    status: GameStatus;
    pauseStartTime?: number;
    lastTick: number;
    totalPauseDuration: number;
    reloadCompleteTime: number;
    generalUpgrades: GameState['generalUpgrades'];
    reloadBoosts: number;
    controlLayout: 'right' | 'left';
    trainingSimState: GameState['trainingSimState'];
    asteroidFieldEndTime: GameState['asteroidFieldEndTime'];
    boss: GameState['boss'];
    score: number;
    highScore: number;
    hasRevive: boolean;
    activeRareConsumable: GameState['activeRareConsumable'];
    hasHereticalInsight: boolean;
    level: number;
    pendingPostFightOutcome: GameState['pendingPostFightOutcome'];
    enemiesDefeatedInLevel: number;
    isHardMode: boolean;
    inGameMessages: GameState['inGameMessages'];
    levelUpAnnounceTime: number;
    pendingEncounter: GameState['pendingEncounter'];
    ammo: number;
    maxAmmo: number;
    levelStreakThisRun: number;
    currencyEarnedThisRun: number;
    partsEarnedThisRun: number;
    isMontezumaActive: boolean;
    asteroids: GameState['asteroids'];
    hapticsEnabled: boolean;
    dispatch: React.Dispatch<GameAction>;
    effectiveNowForOverlay: number;
    lastPauseToggle: React.RefObject<number>;
}

type BossSnapshot = Pick<NonNullable<GameState['boss']>, 'bossType' | 'health' | 'maxHealth' | 'phase'>;
type RareConsumableSnapshot = NonNullable<GameState['activeRareConsumable']>;

interface TrainingSnapshot {
    startTime: number;
    endTime: number;
}

interface MontezumaSnapshot {
    health: number;
    maxHealth: number;
}

interface InGameHUDRenderProps {
    source: InGameHUDProps;
    bossSnapshot: BossSnapshot | null;
    rareConsumableSnapshot: RareConsumableSnapshot | null;
    trainingSnapshot: TrainingSnapshot | null;
    montezumaSnapshot: MontezumaSnapshot | null;
    messageSnapshots: InGameMessage[];
    generalReloadSpeedLevel: number;
    hasPendingPostFightOutcome: boolean;
    hasPendingEncounter: boolean;
}

type ReloadAnimationStyle = React.CSSProperties & {
    '--reload-duration'?: string;
    '--reload-degrees'?: string;
};

const HUD_FRAME_INTERVAL_MS = 1000 / 30;
const MAGAZINE_SLOT_COUNT = 12;

const TrainingCountdown: React.FC<{ startTime: number; now: number }> = ({ startTime, now }) => {
    const remainingMs = startTime - now;
    if (remainingMs <= -500) return null;

    let text = '';
    let key = '';

    if (remainingMs > 2000) {
        text = '3';
        key = '3';
    } else if (remainingMs > 1000) {
        text = '2';
        key = '2';
    } else if (remainingMs > 0) {
        text = '1';
        key = '1';
    } else {
        text = 'GO!';
        key = 'go';
    }

    return (
        <div
            key={key}
            className="pointer-events-none absolute left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 animate-level-up"
        >
            <h2 className="text-7xl font-black uppercase text-yellow-300 [text-shadow:0_0_10px_#ff0,0_0_24px_#f90] sm:text-8xl">
                {text}
            </h2>
        </div>
    );
};

const InGameHUDComponent: React.FC<InGameHUDRenderProps> = ({
    source,
    bossSnapshot,
    rareConsumableSnapshot,
    trainingSnapshot,
    montezumaSnapshot,
    messageSnapshots,
    generalReloadSpeedLevel,
    hasPendingPostFightOutcome,
    hasPendingEncounter,
}) => {
    const {
        status,
        pauseStartTime,
        lastTick,
        totalPauseDuration,
        reloadCompleteTime,
        reloadBoosts,
        controlLayout,
        asteroidFieldEndTime,
        score,
        highScore,
        hasRevive,
        hasHereticalInsight,
        level,
        enemiesDefeatedInLevel,
        isHardMode,
        levelUpAnnounceTime,
        ammo,
        maxAmmo,
        levelStreakThisRun,
        currencyEarnedThisRun,
        partsEarnedThisRun,
        isMontezumaActive,
        hapticsEnabled,
        dispatch,
        effectiveNowForOverlay,
        lastPauseToggle,
    } = source;

    const gameActive = status === GameStatus.Playing
        || status === GameStatus.BossBattle
        || status === GameStatus.AsteroidField
        || status === GameStatus.TrainingSim;
    const isBossFight = status === GameStatus.BossBattle && bossSnapshot !== null;
    const showLevelBar = status === GameStatus.Playing && !hasPendingPostFightOutcome && !isMontezumaActive;
    const showTopBar = showLevelBar || isBossFight;

    const { reloadAnimationStyle, reloadAnimationKey, isReloading } = useMemo(() => {
        const tickToUse = status === GameStatus.Paused ? (pauseStartTime || lastTick) : lastTick;
        const effectiveLastTick = tickToUse > 0 ? tickToUse - totalPauseDuration : 0;
        const reloading = reloadCompleteTime > effectiveLastTick && lastTick > 0;

        if (!reloading) {
            return {
                reloadAnimationStyle: {} as ReloadAnimationStyle,
                reloadAnimationKey: 0,
                isReloading: false,
            };
        }

        let reloadBonus = 0;
        const reloadSpeedConfig = C.HANGAR_GENERAL_UPGRADE_CONFIG?.reload_speed_level;
        if (reloadSpeedConfig && generalReloadSpeedLevel > 0) {
            reloadBonus = reloadSpeedConfig[generalReloadSpeedLevel - 1]?.effect ?? 0;
        }
        const totalReloadReduction = Math.min(
            (reloadBoosts * C.RELOAD_TIME_REDUCTION_PER_STACK) + reloadBonus,
            0.9,
        );
        const currentReloadTime = C.RELOAD_TIME * (1 - totalReloadReduction);
        const totalDegreesToRotate = 1440 * (1 - totalReloadReduction);

        return {
            reloadAnimationStyle: {
                '--reload-duration': `${currentReloadTime / 1000}s`,
                '--reload-degrees': `${totalDegreesToRotate}deg`,
            } as ReloadAnimationStyle,
            reloadAnimationKey: reloadCompleteTime,
            isReloading: true,
        };
    }, [
        generalReloadSpeedLevel,
        lastTick,
        pauseStartTime,
        reloadBoosts,
        reloadCompleteTime,
        status,
        totalPauseDuration,
    ]);

    const bossProgress = bossSnapshot
        ? {
            label: bossSnapshot.bossType.toUpperCase().replace('_', ' '),
            value: bossSnapshot.health,
            max: bossSnapshot.maxHealth,
            valueLabel: `${Math.max(0, Math.ceil(bossSnapshot.health)).toLocaleString()} / ${Math.ceil(bossSnapshot.maxHealth).toLocaleString()}`,
        }
        : null;
    const filledMagazineSlots = maxAmmo > 0
        ? Math.min(MAGAZINE_SLOT_COUNT, Math.ceil((Math.max(0, ammo) / maxAmmo) * MAGAZINE_SLOT_COUNT))
        : 0;
    const visibleMagazineSlots = Math.min(MAGAZINE_SLOT_COUNT, Math.max(0, maxAmmo));
    const showRunEarnings = (levelStreakThisRun > 0 && status !== GameStatus.TrainingSim)
        || currencyEarnedThisRun > 0
        || partsEarnedThisRun > 0;
    const sideInset = 'max(0.75rem, env(safe-area-inset-left, 0px))';
    const oppositeSideInset = 'max(0.75rem, env(safe-area-inset-right, 0px))';
    const reloadSideStyle: React.CSSProperties = controlLayout === 'right'
        ? { left: sideInset }
        : { right: oppositeSideInset };

    const togglePause = (event: React.TouchEvent<HTMLButtonElement> | React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        const now = performance.now();
        if (now - lastPauseToggle.current < 300) return;
        lastPauseToggle.current = now;
        triggerHaptic('uiTap', hapticsEnabled);
        dispatch({ type: 'TOGGLE_PAUSE', timestamp: now });
    };

    return (
        <div className="pointer-events-none absolute inset-0 z-20 text-white">
            <div
                className="absolute inset-x-0 top-0 z-30 px-2 sm:px-4"
                style={{
                    paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))',
                    paddingLeft: 'max(0.5rem, env(safe-area-inset-left, 0px))',
                    paddingRight: 'max(0.5rem, env(safe-area-inset-right, 0px))',
                }}
            >
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(150px,240px)_minmax(0,1fr)] items-start gap-2">
                    <GlassPanel tone="cyan" className="w-fit min-w-[88px] px-2.5 py-1.5">
                        <span className="block text-[9px] font-black uppercase tracking-widest text-cyan-400">Score</span>
                        <span className="block font-mono text-base font-black tabular-nums text-cyan-100 [text-shadow:0_0_8px_rgba(34,211,238,0.65)]">
                            {score.toLocaleString()}
                        </span>
                        <span className="block font-mono text-[9px] tabular-nums text-slate-400">
                            HI {highScore.toLocaleString()}
                        </span>
                    </GlassPanel>

                    <div className="min-w-0 pt-0.5">
                        {showTopBar && (
                            <StatBar
                                value={bossProgress?.value ?? enemiesDefeatedInLevel}
                                max={bossProgress?.max ?? C.ENEMIES_PER_LEVEL}
                                label={bossProgress?.label ?? `LEVEL ${level}`}
                                valueLabel={bossProgress?.valueLabel ?? `${enemiesDefeatedInLevel} / ${C.ENEMIES_PER_LEVEL}`}
                                tone={isBossFight ? 'magenta' : 'cyan'}
                                segments={isBossFight ? 8 : Math.min(10, Math.max(1, C.ENEMIES_PER_LEVEL))}
                                compact
                            />
                        )}
                    </div>

                    <div className="flex min-w-0 flex-col items-end gap-1.5">
                        {(gameActive || status === GameStatus.Paused) && (
                            <button
                                type="button"
                                onTouchStart={togglePause}
                                onClick={togglePause}
                                className="hud-glass pointer-events-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border-cyan-300/25 text-cyan-100 transition-[transform,opacity] duration-150 active:scale-95"
                                aria-label={status === GameStatus.Paused ? 'Close pause menu' : 'Pause game'}
                            >
                                {status === GameStatus.Paused ? <X size={22} /> : <Pause size={22} fill="currentColor" />}
                            </button>
                        )}
                        {isHardMode && <Badge tone="danger" pulse>Hard mode</Badge>}
                    </div>
                </div>
            </div>

            {gameActive && (hasRevive || rareConsumableSnapshot || hasHereticalInsight) && (
                <div
                    className="absolute z-30 flex max-w-[calc(100%-1rem)] flex-wrap items-center gap-1.5"
                    style={{
                        top: 'calc(4.75rem + env(safe-area-inset-top, 0px))',
                        left: sideInset,
                    }}
                    aria-label="Active combat effects"
                >
                    {hasRevive && (
                        <Badge tone="magenta" pulse title="Revive equipped">
                            <HeartPulse size={13} aria-hidden="true" />
                            Revive
                        </Badge>
                    )}
                    {rareConsumableSnapshot?.type === 'corrosive' && (
                        <Badge tone="lime" pulse title="Corrosive rounds active">
                            <FlaskConical size={13} aria-hidden="true" />
                            Corrosive {rareConsumableSnapshot.shotsLeft}
                        </Badge>
                    )}
                    {hasHereticalInsight && (
                        <Badge tone="violet" title="Double damage against the Overmind">
                            <Eye size={13} aria-hidden="true" />
                            Insight
                        </Badge>
                    )}
                </div>
            )}

            {gameActive && ammo === 0 && !isReloading && (
                <div
                    className="absolute z-30 flex w-16 animate-pulse flex-col items-center text-red-300"
                    style={{
                        ...reloadSideStyle,
                        bottom: 'calc(10.25rem + env(safe-area-inset-bottom, 0px))',
                    }}
                    aria-hidden="true"
                >
                    <span className="hud-glass rounded border-red-400/45 px-2 py-1 text-[10px] font-black uppercase tracking-widest">
                        Reload
                    </span>
                    <RotateCcw size={18} className="mt-1" />
                </div>
            )}

            {gameActive && (
                <button
                    type="button"
                    onTouchStart={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        triggerHaptic('uiTap', hapticsEnabled);
                        dispatch({ type: 'RELOAD_GUN' });
                    }}
                    onClick={(event) => {
                        event.preventDefault();
                        triggerHaptic('uiTap', hapticsEnabled);
                        dispatch({ type: 'RELOAD_GUN' });
                    }}
                    className="hud-glass pointer-events-auto absolute z-40 flex h-16 w-16 items-center justify-center rounded-full border-2 border-cyan-300/35 text-cyan-100 shadow-neon-cyan transition-[transform,opacity] duration-150 active:scale-95"
                    style={{
                        ...reloadSideStyle,
                        bottom: 'calc(5.75rem + env(safe-area-inset-bottom, 0px))',
                    }}
                    aria-label={isReloading ? 'Reloading' : 'Reload weapon'}
                >
                    <RotateCcw
                        key={reloadAnimationKey}
                        size={30}
                        className={isReloading ? 'animate-reloading-spin' : ''}
                        style={isReloading ? reloadAnimationStyle : undefined}
                        aria-hidden="true"
                    />
                </button>
            )}

            {status === GameStatus.TrainingSim
                && trainingSnapshot
                && effectiveNowForOverlay < trainingSnapshot.startTime && (
                <TrainingCountdown startTime={trainingSnapshot.startTime} now={effectiveNowForOverlay} />
            )}

            {status === GameStatus.AsteroidField && asteroidFieldEndTime && (
                <SurvivalTimerBar
                    endTime={asteroidFieldEndTime}
                    now={effectiveNowForOverlay}
                    duration={C.ASTEROID_FIELD_DURATION}
                    title="Survival"
                />
            )}
            {status === GameStatus.TrainingSim
                && trainingSnapshot
                && effectiveNowForOverlay >= trainingSnapshot.startTime && (
                <>
                    <div
                        className="pointer-events-none absolute left-1/2 z-30 w-[min(70%,18rem)] -translate-x-1/2 text-center text-xs font-bold uppercase tracking-wider text-cyan-200 [text-shadow:0_0_6px_#0ff]"
                        style={{ top: 'calc(5.75rem + env(safe-area-inset-top, 0px))' }}
                    >
                        Don't overshoot
                    </div>
                    <SurvivalTimerBar
                        endTime={trainingSnapshot.endTime}
                        now={effectiveNowForOverlay}
                        duration={C.TRAINING_SIM_DURATION}
                        title="Time remaining"
                    />
                </>
            )}

            {isMontezumaActive && montezumaSnapshot && (
                <div
                    className="pointer-events-none absolute left-1/2 z-20 w-[min(58%,18rem)] -translate-x-1/2"
                    style={{ top: 'calc(4.75rem + env(safe-area-inset-top, 0px))' }}
                >
                    <StatBar
                        value={montezumaSnapshot.health}
                        max={montezumaSnapshot.maxHealth}
                        label="Montezuma"
                        valueLabel={`${Math.max(0, Math.ceil(montezumaSnapshot.health)).toLocaleString()}`}
                        tone="gold"
                        segments={8}
                        compact
                    />
                </div>
            )}

            <InGameMessageOverlay messages={messageSnapshots} now={effectiveNowForOverlay} />

            {levelUpAnnounceTime > 0
                && effectiveNowForOverlay - levelUpAnnounceTime < C.LEVEL_UP_ANNOUNCE_DURATION
                && !hasPendingEncounter && (
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-50 w-[calc(100%-1rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 animate-level-up">
                    <div className="border-y border-yellow-300/60 bg-slate-950/80 px-3 py-4 text-center shadow-[0_0_35px_rgba(250,204,21,0.18)]">
                        <span className="block text-[10px] font-black uppercase tracking-[0.35em] text-yellow-100">Level {level}</span>
                        <h2 className="mt-1 text-4xl font-black uppercase text-yellow-300 [text-shadow:0_0_10px_#ff0,0_0_24px_#f90] sm:text-6xl">
                            Level Up
                        </h2>
                    </div>
                </div>
            )}

            <GlassPanel
                tone={ammo === 0 ? 'danger' : 'cyan'}
                className="absolute z-20 w-[10.75rem] px-2.5 py-2"
                style={{
                    left: sideInset,
                    bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
                }}
            >
                <div className="flex items-center justify-between gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                        {isReloading ? 'Reloading' : 'Magazine'}
                    </span>
                    <span className={cx(
                        'font-mono text-xs font-black tabular-nums',
                        ammo === 0 ? 'text-red-300' : isReloading ? 'text-yellow-300' : 'text-cyan-100',
                    )}>
                        {ammo} / {maxAmmo}
                    </span>
                </div>
                <div
                    className="mt-1.5 grid h-4 grid-cols-12 items-end gap-1"
                    role="progressbar"
                    aria-label="Rounds remaining"
                    aria-valuemin={0}
                    aria-valuemax={maxAmmo}
                    aria-valuenow={Math.max(0, ammo)}
                >
                    {Array.from({ length: MAGAZINE_SLOT_COUNT }, (_, index) => {
                        const slotIsVisible = index < visibleMagazineSlots;
                        const slotIsFilled = index < filledMagazineSlots;
                        return (
                            <span
                                key={index}
                                className={cx(
                                    'h-4 origin-bottom rounded-t-full rounded-b-sm border transition-[transform,opacity] duration-100',
                                    !slotIsVisible && 'opacity-0',
                                    slotIsVisible && slotIsFilled && 'scale-y-100 border-cyan-200/70 bg-cyan-300 opacity-100 shadow-[0_0_6px_rgba(34,211,238,0.55)]',
                                    slotIsVisible && !slotIsFilled && 'scale-y-75 border-slate-500/35 bg-slate-700 opacity-35',
                                )}
                                aria-hidden="true"
                            />
                        );
                    })}
                </div>
            </GlassPanel>

            {showRunEarnings && (
                <div
                    className="absolute z-20 flex max-w-[48%] flex-wrap justify-end gap-1.5"
                    style={{
                        right: oppositeSideInset,
                        bottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
                    }}
                    aria-label="Run earnings"
                >
                    {levelStreakThisRun > 0 && status !== GameStatus.TrainingSim && (
                        <Badge tone="cyan">
                            <Flame size={13} aria-hidden="true" />
                            x{(1 + levelStreakThisRun * getStreakBonus(isHardMode)).toFixed(2)}
                        </Badge>
                    )}
                    {currencyEarnedThisRun > 0 && (
                        <CurrencyChip
                            icon={<Coins size={14} />}
                            label="Credits earned"
                            value={`+${currencyEarnedThisRun.toLocaleString()}`}
                            tone="gold"
                            className="min-h-8 px-2 py-1"
                        />
                    )}
                    {partsEarnedThisRun > 0 && (
                        <CurrencyChip
                            icon={<Wrench size={14} />}
                            label="Upgrade parts earned"
                            value={`+${partsEarnedThisRun.toLocaleString()}`}
                            tone="violet"
                            className="min-h-8 px-2 py-1"
                        />
                    )}
                </div>
            )}
        </div>
    );
};

const messagesMatch = (previous: InGameMessage[], next: InGameMessage[]) => {
    if (previous.length !== next.length) return false;
    return previous.every((message, index) => {
        const candidate = next[index];
        return message.id === candidate.id
            && message.text === candidate.text
            && message.createdAt === candidate.createdAt
            && message.duration === candidate.duration
            && message.style === candidate.style;
    });
};

const bossSnapshotsMatch = (previous: BossSnapshot | null, next: BossSnapshot | null) => (
    previous === next
    || (previous !== null
        && next !== null
        && previous.bossType === next.bossType
        && previous.health === next.health
        && previous.maxHealth === next.maxHealth
        && previous.phase === next.phase)
);

const hudRenderPropsMatch = (previous: InGameHUDRenderProps, next: InGameHUDRenderProps) => {
    const prev = previous.source;
    const current = next.source;

    if (
        prev.status !== current.status
        || prev.pauseStartTime !== current.pauseStartTime
        || prev.totalPauseDuration !== current.totalPauseDuration
        || prev.reloadCompleteTime !== current.reloadCompleteTime
        || prev.reloadBoosts !== current.reloadBoosts
        || prev.controlLayout !== current.controlLayout
        || prev.asteroidFieldEndTime !== current.asteroidFieldEndTime
        || prev.score !== current.score
        || prev.highScore !== current.highScore
        || prev.hasRevive !== current.hasRevive
        || prev.hasHereticalInsight !== current.hasHereticalInsight
        || prev.level !== current.level
        || prev.enemiesDefeatedInLevel !== current.enemiesDefeatedInLevel
        || prev.isHardMode !== current.isHardMode
        || prev.levelUpAnnounceTime !== current.levelUpAnnounceTime
        || prev.ammo !== current.ammo
        || prev.maxAmmo !== current.maxAmmo
        || prev.levelStreakThisRun !== current.levelStreakThisRun
        || prev.currencyEarnedThisRun !== current.currencyEarnedThisRun
        || prev.partsEarnedThisRun !== current.partsEarnedThisRun
        || prev.isMontezumaActive !== current.isMontezumaActive
        || prev.hapticsEnabled !== current.hapticsEnabled
        || prev.dispatch !== current.dispatch
        || prev.lastPauseToggle !== current.lastPauseToggle
        || previous.generalReloadSpeedLevel !== next.generalReloadSpeedLevel
        || previous.hasPendingPostFightOutcome !== next.hasPendingPostFightOutcome
        || previous.hasPendingEncounter !== next.hasPendingEncounter
        || previous.rareConsumableSnapshot?.type !== next.rareConsumableSnapshot?.type
        || previous.rareConsumableSnapshot?.shotsLeft !== next.rareConsumableSnapshot?.shotsLeft
        || previous.trainingSnapshot?.startTime !== next.trainingSnapshot?.startTime
        || previous.trainingSnapshot?.endTime !== next.trainingSnapshot?.endTime
        || previous.montezumaSnapshot?.health !== next.montezumaSnapshot?.health
        || previous.montezumaSnapshot?.maxHealth !== next.montezumaSnapshot?.maxHealth
        || !bossSnapshotsMatch(previous.bossSnapshot, next.bossSnapshot)
        || !messagesMatch(previous.messageSnapshots, next.messageSnapshots)
    ) {
        return false;
    }

    const overlayClockDelta = Math.abs(current.effectiveNowForOverlay - prev.effectiveNowForOverlay);
    const engineClockDelta = Math.abs(current.lastTick - prev.lastTick);
    return Math.max(overlayClockDelta, engineClockDelta) < HUD_FRAME_INTERVAL_MS;
};

const MemoizedInGameHUD = React.memo(InGameHUDComponent, hudRenderPropsMatch);

// Snapshot mutable engine objects before memoization so health and message changes cannot be hidden
// by stable object identities. Only pure clock updates are allowed through at the 30 fps HUD budget.
export const InGameHUD: React.FC<InGameHUDProps> = (props) => {
    const bossSnapshot: BossSnapshot | null = props.boss
        ? {
            bossType: props.boss.bossType,
            health: props.boss.health,
            maxHealth: props.boss.maxHealth,
            phase: props.boss.phase,
        }
        : null;
    const rareConsumableSnapshot = props.activeRareConsumable
        ? { ...props.activeRareConsumable }
        : null;
    const trainingSnapshot = props.trainingSimState
        ? {
            startTime: props.trainingSimState.startTime,
            endTime: props.trainingSimState.endTime,
        }
        : null;
    const montezuma = props.isMontezumaActive
        ? props.asteroids.find((asteroid) => asteroid.id === -999)
        : null;
    const montezumaSnapshot = montezuma
        ? { health: montezuma.health, maxHealth: montezuma.maxHealth }
        : null;

    return (
        <MemoizedInGameHUD
            source={props}
            bossSnapshot={bossSnapshot}
            rareConsumableSnapshot={rareConsumableSnapshot}
            trainingSnapshot={trainingSnapshot}
            montezumaSnapshot={montezumaSnapshot}
            messageSnapshots={props.inGameMessages.map((message) => ({ ...message }))}
            generalReloadSpeedLevel={props.generalUpgrades.reload_speed_level ?? 0}
            hasPendingPostFightOutcome={Boolean(props.pendingPostFightOutcome)}
            hasPendingEncounter={Boolean(props.pendingEncounter)}
        />
    );
};
