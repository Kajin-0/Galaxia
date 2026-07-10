import React, { useState } from 'react';
import {
  Crosshair,
  Gauge,
  Lock,
  Orbit,
  Rocket,
  ShieldPlus,
  ShoppingBag,
  Skull,
  TimerReset,
  Trophy,
  Warehouse,
  Wind,
  Wrench,
} from 'lucide-react';
import { playSound } from '../../sounds';
import type { Consumables, GameAction, HeroType } from '../../types';
import * as C from '../../constants';
import { triggerHaptic } from '../../utils/haptics';
import { HeroPreviewCanvas } from './HeroPreviewCanvas';
import { Badge, GlassPanel, NeonButton, ScreenShell, StatBar, Toggle, cx } from './shared';

interface HeroPreviewInfo {
  name: string;
  role: string;
  description: string;
  accent: string;
  idleAccent: string;
}

const heroPreviews: Record<HeroType, HeroPreviewInfo> = {
  alpha: {
    name: 'Alpha',
    role: 'Vanguard',
    description: '+5% critical hit chance',
    accent: 'border-cyan-300/60 text-cyan-200 shadow-neon-cyan',
    idleAccent: 'border-cyan-500/25 text-cyan-300/65 hover:border-cyan-300/45',
  },
  beta: {
    name: 'Beta',
    role: 'Interceptor',
    description: 'Enhanced agility',
    accent: 'border-violet-300/60 text-violet-200 shadow-neon-violet',
    idleAccent: 'border-violet-500/25 text-violet-300/65 hover:border-violet-300/45',
  },
  gamma: {
    name: 'Gamma',
    role: 'Bulwark',
    description: '+25% shield chance on level up',
    accent: 'border-lime-300/60 text-lime-200 shadow-[0_0_24px_rgba(163,230,53,0.18)]',
    idleAccent: 'border-lime-500/25 text-lime-300/65 hover:border-lime-300/45',
  },
};

interface StartScreenProps {
  onStart: (consumables: Consumables, isHardMode: boolean) => void;
  dispatch: React.Dispatch<GameAction>;
  highScore: number;
  unlockedHeroes: { beta: boolean; gamma: boolean };
  cumulativeScore: number;
  cumulativeLevels: number;
  ownedRevives: number;
  ownedFastReloads: number;
  ownedRapidFires: number;
  ownedSpeedBoosts: number;
  selectedHero: HeroType;
  onSelectHero: (hero: HeroType) => void;
  bossesDefeated: number;
  hardModeUnlocked: boolean;
  hardModePreference: boolean;
  onSetHardModePreference: (value: boolean) => void;
  hapticsEnabled: boolean;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  onStart,
  dispatch,
  highScore,
  unlockedHeroes,
  cumulativeScore,
  cumulativeLevels,
  ownedRevives,
  ownedFastReloads,
  ownedRapidFires,
  ownedSpeedBoosts,
  selectedHero,
  onSelectHero,
  bossesDefeated,
  hardModeUnlocked,
  hardModePreference,
  onSetHardModePreference,
  hapticsEnabled,
}) => {
  const [consumables, setConsumables] = useState<Consumables>({
    useRevive: false,
    useFastReload: false,
    useRapidFire: false,
    useSpeedBoost: false,
  });

  const heroUnlockStatus: Record<HeroType, { isUnlocked: boolean; requirement: string; current: number; target: number }> = {
    alpha: { isUnlocked: true, requirement: 'Flight ready', current: 1, target: 1 },
    beta: {
      isUnlocked: unlockedHeroes.beta,
      requirement: `Reach total level ${C.BETA_UNLOCK_LEVELS}`,
      current: Math.min(cumulativeLevels, C.BETA_UNLOCK_LEVELS),
      target: C.BETA_UNLOCK_LEVELS,
    },
    gamma: {
      isUnlocked: unlockedHeroes.gamma,
      requirement: `Reach ${C.GAMMA_UNLOCK_SCORE.toLocaleString()} total score`,
      current: Math.min(cumulativeScore, C.GAMMA_UNLOCK_SCORE),
      target: C.GAMMA_UNLOCK_SCORE,
    },
  };

  const selectedInfo = heroPreviews[selectedHero];
  const selectedUnlock = heroUnlockStatus[selectedHero];
  const hangarUnlocked = bossesDefeated > 0;

  const consumableChecks = [
    { id: 'useRevive', label: C.CONSUMABLE_NAMES.revive, owned: ownedRevives, icon: ShieldPlus, tone: 'text-pink-300' },
    { id: 'useFastReload', label: C.CONSUMABLE_NAMES.fastReload, owned: ownedFastReloads, icon: TimerReset, tone: 'text-yellow-300' },
    { id: 'useRapidFire', label: C.CONSUMABLE_NAMES.rapidFire, owned: ownedRapidFires, icon: Gauge, tone: 'text-red-300' },
    { id: 'useSpeedBoost', label: C.CONSUMABLE_NAMES.speedBoost, owned: ownedSpeedBoosts, icon: Wind, tone: 'text-blue-300' },
  ] as const;

  const navigate = (action: GameAction) => {
    playSound('uiClick');
    triggerHaptic('uiTap', hapticsEnabled);
    dispatch(action);
  };

  return (
    <ScreenShell modal={false} dim="none" titleId="galaxia-title" contentClassName="mx-auto max-w-2xl sm:justify-center">
      <header className="flex w-full shrink-0 items-start justify-between gap-3 px-1 pb-2 pt-1">
        <div className="min-w-0 text-left">
          <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/75">
            <Orbit className="h-3.5 w-3.5" aria-hidden="true" />
            Deep-space command
          </div>
          <h1 id="galaxia-title" className="neon-title text-4xl font-black uppercase leading-none sm:text-5xl">
            Galaxia
          </h1>
        </div>
        <div className="mt-1 flex min-h-9 shrink-0 items-center gap-2 rounded-md border border-yellow-300/25 bg-slate-950/60 px-3">
          <Trophy className="h-4 w-4 text-yellow-300" aria-hidden="true" />
          <span className="sr-only">High score: </span>
          <span className="font-mono text-sm font-bold tabular-nums text-yellow-100">{highScore.toLocaleString()}</span>
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col gap-3 pb-1 sm:flex-none">
        <section aria-labelledby="hero-select-title">
          <div className="mb-2 flex items-end justify-between gap-3 px-1">
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Flight deck</p>
              <h2 id="hero-select-title" className="text-base font-black uppercase text-slate-100">Select craft</h2>
            </div>
            <Badge tone={selectedUnlock.isUnlocked ? 'cyan' : 'gold'}>
              {selectedUnlock.isUnlocked ? selectedInfo.role : 'Locked'}
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2" role="list" aria-label="Available ships">
            {(Object.keys(heroPreviews) as HeroType[]).map(hero => {
              const info = heroPreviews[hero];
              const unlock = heroUnlockStatus[hero];
              const isSelected = selectedHero === hero;
              return (
                <button
                  key={hero}
                  type="button"
                  role="listitem"
                  aria-pressed={isSelected}
                  aria-label={`${info.name}, ${info.role}${unlock.isUnlocked ? '' : ', locked'}`}
                  onClick={() => {
                    playSound('uiClick');
                    triggerHaptic('uiTap', hapticsEnabled);
                    onSelectHero(hero);
                  }}
                  className={cx(
                    'relative min-w-0 overflow-hidden rounded-md border bg-slate-950/55 px-1.5 pb-2 pt-1 text-center',
                    'transition-[transform,border-color,background-color,box-shadow] duration-200 ease-expo active:scale-[0.97]',
                    isSelected ? info.accent : `${info.idleAccent} hover:bg-slate-900/70`,
                  )}
                >
                  <span className="relative mx-auto block h-20 w-full max-w-[128px] sm:h-24">
                    <HeroPreviewCanvas hero={hero} selected={isSelected} locked={!unlock.isUnlocked} />
                    {!unlock.isUnlocked && (
                      <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
                        <span className="grid h-9 w-9 place-items-center rounded-full border border-yellow-300/35 bg-slate-950/80">
                          <Lock className="h-4 w-4 text-yellow-200" />
                        </span>
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs font-black uppercase sm:text-sm">{info.name}</span>
                  <span className="mt-0.5 block truncate text-[9px] font-bold uppercase tracking-wider text-slate-500 sm:text-[10px]">{info.role}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-2 min-h-10 px-1 text-left">
            {selectedUnlock.isUnlocked ? (
              <p className="text-xs font-medium text-slate-300">{selectedInfo.description}</p>
            ) : (
              <StatBar
                value={selectedUnlock.current}
                max={selectedUnlock.target}
                label={selectedUnlock.requirement}
                valueLabel={`${selectedUnlock.current.toLocaleString()} / ${selectedUnlock.target.toLocaleString()}`}
                tone="gold"
                compact
              />
            )}
          </div>
        </section>

        <GlassPanel className="p-3" tone={hardModePreference ? 'magenta' : 'neutral'}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-left">
              <Crosshair className="h-4 w-4 text-cyan-300" aria-hidden="true" />
              <div>
                <h2 className="text-sm font-black uppercase text-slate-100">Loadout</h2>
                <p className="text-[10px] text-slate-500">Consumables are spent on launch</p>
              </div>
            </div>
            <Badge tone="neutral">Optional</Badge>
          </div>

          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            {consumableChecks.map(item => {
              const checked = consumables[item.id];
              const remaining = Math.max(0, item.owned - (checked ? 1 : 0));
              const Icon = item.icon;
              return (
                <Toggle
                  key={item.id}
                  checked={checked}
                  onChange={value => {
                    playSound('uiClick');
                    triggerHaptic('uiTap', hapticsEnabled);
                    setConsumables(current => ({ ...current, [item.id]: value }));
                  }}
                  disabled={item.owned === 0}
                  label={item.label}
                  description={`${remaining} remaining`}
                  icon={<Icon className={cx('h-4 w-4', item.tone)} />}
                  className="border-t border-slate-700/45 py-2 first:border-t-0 sm:[&:nth-child(2)]:border-t-0"
                />
              );
            })}
          </div>

          {hardModeUnlocked && (
            <div className="mt-1 border-t border-pink-400/20 pt-2">
              <Toggle
                checked={hardModePreference}
                onChange={value => {
                  playSound('uiClick');
                  triggerHaptic('uiWarning', hapticsEnabled);
                  onSetHardModePreference(value);
                }}
                label="Hard mode"
                description="Hostiles strike faster and punish mistakes"
                tone="magenta"
              />
            </div>
          )}
        </GlassPanel>

        <nav className="grid grid-cols-3 gap-2" aria-label="Command sections">
          <NeonButton variant="quiet" icon={<Wrench className="h-4 w-4" />} onClick={() => navigate({ type: 'GO_TO_ARMORY' })} className="px-2 text-[11px]">
            Armory
          </NeonButton>
          <div className="relative">
            <NeonButton
              variant="quiet"
              icon={hangarUnlocked ? <Warehouse className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              onClick={() => navigate({ type: 'GO_TO_HANGAR' })}
              disabled={!hangarUnlocked}
              fullWidth
              className="px-2 text-[11px]"
            >
              Hangar
            </NeonButton>
          </div>
          <NeonButton variant="quiet" icon={<ShoppingBag className="h-4 w-4" />} onClick={() => navigate({ type: 'GO_TO_STORE' })} className="px-2 text-[11px]">
            Store
          </NeonButton>
        </nav>

        <NeonButton
          fullWidth
          icon={selectedUnlock.isUnlocked ? <Rocket className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          onClick={() => {
            triggerHaptic('uiConfirm', hapticsEnabled);
            onStart(consumables, hardModePreference);
          }}
          disabled={!selectedUnlock.isUnlocked}
          variant={hardModePreference ? 'danger' : 'primary'}
          className="min-h-14 text-base"
        >
          {selectedUnlock.isUnlocked ? (hardModePreference ? 'Launch hard mode' : 'Launch mission') : 'Craft locked'}
        </NeonButton>

        {hardModePreference && (
          <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-red-300" role="status">
            <Skull className="h-3.5 w-3.5" aria-hidden="true" />
            Threat protocol armed
          </div>
        )}
      </main>
    </ScreenShell>
  );
};
