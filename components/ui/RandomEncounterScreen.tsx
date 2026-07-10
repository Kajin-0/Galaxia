import React, { useEffect, useId } from 'react';
import { ChevronRight, Coins, Package, Radio, Search, Waypoints } from 'lucide-react';
import { playSound } from '../../sounds';
import type { ConsumableItem, Encounter, PossibleOutcome } from '../../types';
import * as C from '../../constants';
import { Badge, GlassPanel, NeonButton, ScreenShell } from './primitives';

interface RandomEncounterScreenProps {
  encounter: Encounter;
  onChoose: (outcomes: PossibleOutcome[]) => void;
  totalCurrency: number;
  currencyEarnedThisRun: number;
  ownedRevives: number;
  ownedFastReloads: number;
  ownedRapidFires: number;
  ownedSpeedBoosts: number;
}

export const RandomEncounterScreen: React.FC<RandomEncounterScreenProps> = ({
  encounter,
  onChoose,
  totalCurrency,
  currencyEarnedThisRun,
  ownedRevives,
  ownedFastReloads,
  ownedRapidFires,
  ownedSpeedBoosts,
}) => {
  const titleId = useId();
  const choiceIdPrefix = useId();
  const availableCurrency = totalCurrency + currencyEarnedThisRun;

  useEffect(() => {
    playSound('secretFound');
  }, []);

  const getOwnedCount = (type: ConsumableItem): number => {
    switch (type) {
      case 'revive': return ownedRevives;
      case 'fastReload': return ownedFastReloads;
      case 'rapidFire': return ownedRapidFires;
      case 'speedBoost': return ownedSpeedBoosts;
      default: return 0;
    }
  };

  const handleChoice = (outcomes: PossibleOutcome[]) => {
    playSound('uiClick');
    onChoose(outcomes);
  };

  return (
    <ScreenShell titleId={titleId} contentClassName="justify-center">
      <GlassPanel tone="violet" className="relative my-auto w-full max-w-2xl overflow-hidden p-5 sm:p-7">
        <div className="scan-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative z-[1]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <Badge tone="violet" pulse>
              <Radio className="h-3 w-3" aria-hidden="true" />
              Anomaly detected
            </Badge>
            <Badge tone="gold">
              <Coins className="h-3 w-3" aria-hidden="true" />
              {availableCurrency.toLocaleString()} available
            </Badge>
          </div>

          <div className="mb-5 flex items-start gap-3 border-b border-violet-300/20 pb-5 text-left">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-violet-300/40 bg-violet-400/10 text-violet-200 shadow-neon-violet">
              <Waypoints className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-wider text-violet-300">Unverified transmission</p>
              <h2 id={titleId} className="mt-1 text-2xl font-black leading-tight text-slate-50 sm:text-3xl">
                {encounter.title}
              </h2>
            </div>
          </div>

          <p className="whitespace-pre-wrap text-left text-sm leading-relaxed text-slate-200 sm:text-base">
            {encounter.text}
          </p>

          <div className="mt-6 flex w-full flex-col gap-3" aria-label="Encounter choices">
            {encounter.isChoice ? encounter.choices?.map((choice, index) => {
              const tradeResult = choice.outcomes.find((outcome) => outcome.result.type === 'trade')?.result;
              const cost = tradeResult?.cost ?? 0;
              const consumableType = tradeResult?.costConsumableType;
              const consumableQuantity = tradeResult?.costConsumableQuantity ?? 1;
              const ownedConsumables = consumableType ? getOwnedCount(consumableType) : 0;
              const currencyShortfall = Math.max(0, cost - availableCurrency);
              const consumableShortfall = consumableType ? Math.max(0, consumableQuantity - ownedConsumables) : 0;
              const isDisabled = currencyShortfall > 0 || consumableShortfall > 0;
              const statusId = `${choiceIdPrefix}-${index}`;
              const requirements: string[] = [];
              const shortfalls: string[] = [];

              if (cost > 0) requirements.push(`${cost.toLocaleString()} currency`);
              if (consumableType) {
                requirements.push(`${consumableQuantity} ${C.CONSUMABLE_NAMES[consumableType]}`);
              }
              if (currencyShortfall > 0) shortfalls.push(`need ${currencyShortfall.toLocaleString()} more currency`);
              if (consumableType && consumableShortfall > 0) {
                shortfalls.push(`need ${consumableShortfall} more ${C.CONSUMABLE_NAMES[consumableType]}`);
              }

              const statusText = isDisabled
                ? `Unavailable: ${shortfalls.join(' and ')}`
                : requirements.length > 0
                  ? `Cost: ${requirements.join(' and ')}`
                  : 'No resource cost';

              return (
                <NeonButton
                  key={`${index}-${choice.text}`}
                  variant={isDisabled ? 'quiet' : 'secondary'}
                  fullWidth
                  disabled={isDisabled}
                  onClick={() => handleChoice(choice.outcomes)}
                  aria-describedby={statusId}
                  title={isDisabled ? statusText : undefined}
                  className="min-h-[60px] justify-start px-4 py-3 text-left normal-case tracking-normal [&>span]:w-full [&>span]:overflow-visible [&>span]:whitespace-normal"
                >
                  <span className="flex w-full items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-violet-300/25 bg-violet-400/10 text-violet-200">
                      <Waypoints className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black leading-snug text-slate-100 sm:text-base">{choice.text}</span>
                      <span
                        id={statusId}
                        className={`mt-1 flex items-center gap-1.5 text-xs font-semibold ${isDisabled ? 'text-red-300' : requirements.length > 0 ? 'text-yellow-200' : 'text-slate-400'}`}
                      >
                        {consumableType ? <Package className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <Coins className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                        {statusText}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-violet-200" aria-hidden="true" />
                  </span>
                </NeonButton>
              );
            }) : (
              <NeonButton
                fullWidth
                onClick={() => handleChoice(encounter.outcomes || [])}
                icon={<Search className="h-5 w-5" />}
                iconAfter={<ChevronRight className="h-5 w-5" />}
                className="min-h-[52px]"
              >
                Investigate signal
              </NeonButton>
            )}
          </div>
        </div>
      </GlassPanel>
    </ScreenShell>
  );
};
