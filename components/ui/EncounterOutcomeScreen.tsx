import React, { useCallback, useEffect, useId, useMemo } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  CircleCheckBig,
  CircleMinus,
  Radio,
  ShieldAlert,
} from 'lucide-react';
import { playSound } from '../../sounds';
import type { OutcomeResult } from '../../types';
import * as C from '../../constants';
import { Badge, GlassPanel, NeonButton, ScreenShell } from './primitives';

type OutcomeSentiment = 'good' | 'bad' | 'neutral';
type DetailTone = 'gain' | 'loss' | 'special';

interface OutcomeDetail {
  key: string;
  label: string;
  tone: DetailTone;
}

const getOutcomeSentiment = (outcome: OutcomeResult): OutcomeSentiment => {
  if (outcome.unlocksTrident || outcome.gainHereticalInsight) return 'good';

  switch (outcome.type) {
    case 'gain_items':
    case 'dialogue_reward':
    case 'fight_reward':
    case 'gain_consumables':
    case 'gain_rare_consumable':
      return 'good';
    case 'trade':
      return (outcome.parts ?? 0) > 0 || (outcome.currency ?? 0) > 0 ? 'good' : 'bad';
    case 'level_skip':
      if ((outcome.levels ?? 0) > 0) return 'good';
      if ((outcome.levels ?? 0) < 0) return 'bad';
      return 'neutral';
    case 'lose_all_items':
    case 'lose_random_items':
    case 'damage_ship':
      return 'bad';
    case 'nothing':
    case 'special_event':
    case 'fight':
    default:
      return 'neutral';
  }
};

const getOutcomeDetails = (outcome: OutcomeResult): OutcomeDetail[] => {
  const details: OutcomeDetail[] = [];

  if (outcome.cost) {
    details.push({ key: 'cost-currency', label: `-${outcome.cost.toLocaleString()} currency`, tone: 'loss' });
  }
  if (outcome.costConsumableType) {
    const quantity = outcome.costConsumableQuantity ?? 1;
    const name = C.CONSUMABLE_NAMES[outcome.costConsumableType] || outcome.costConsumableType;
    details.push({ key: 'cost-consumable', label: `-${quantity}x ${name}`, tone: 'loss' });
  }
  if (outcome.currency && outcome.currency < 0) {
    details.push({ key: 'lost-currency', label: `-${Math.abs(outcome.currency).toLocaleString()} currency`, tone: 'loss' });
  }
  if (outcome.levels && outcome.levels < 0) {
    details.push({ key: 'lost-levels', label: `${outcome.levels} levels`, tone: 'loss' });
  }
  if (outcome.lostItems) {
    outcome.lostItems.forEach((item) => {
      const name = C.CONSUMABLE_NAMES[item.type] || item.type;
      details.push({ key: `lost-${item.type}`, label: `-${item.quantity}x ${name}`, tone: 'loss' });
    });
  } else if (outcome.itemLossCount) {
    details.push({ key: 'lost-items', label: `-${outcome.itemLossCount} random consumables`, tone: 'loss' });
  }

  if (outcome.currency && outcome.currency > 0) {
    details.push({ key: 'gain-currency', label: `+${outcome.currency.toLocaleString()} currency`, tone: 'gain' });
  }
  if (outcome.parts) {
    details.push({ key: 'gain-parts', label: `+${outcome.parts} upgrade parts`, tone: 'gain' });
  }
  if (outcome.levels && outcome.levels > 0) {
    details.push({ key: 'gain-levels', label: `+${outcome.levels} level skip${outcome.levels > 1 ? 's' : ''}`, tone: 'gain' });
  }
  if (outcome.consumableQuantity && outcome.consumableType) {
    const name = C.CONSUMABLE_NAMES[outcome.consumableType] || outcome.consumableType;
    details.push({ key: 'gain-consumable', label: `+${outcome.consumableQuantity}x ${name}`, tone: 'gain' });
  }
  if (outcome.rareConsumableType && outcome.rareConsumableShots) {
    details.push({ key: 'gain-rare-consumable', label: `+${outcome.rareConsumableShots}x Corrosive Rounds`, tone: 'special' });
  }
  if (outcome.unlocksTrident) {
    details.push({ key: 'unlock-trident', label: 'Trident Weapon System unlocked', tone: 'special' });
  }
  if (outcome.gainHereticalInsight) {
    details.push({ key: 'unlock-insight', label: 'Heretical Insight acquired', tone: 'special' });
  }

  return details;
};

export const EncounterOutcomeScreen: React.FC<{ outcome: OutcomeResult; onDismiss: () => void }> = ({ outcome, onDismiss }) => {
  const titleId = useId();
  const sentiment = getOutcomeSentiment(outcome);
  const details = useMemo(() => getOutcomeDetails(outcome), [outcome]);
  const OutcomeIcon = sentiment === 'good' ? CircleCheckBig : sentiment === 'bad' ? ShieldAlert : Radio;
  const sentimentLabel = sentiment === 'good' ? 'Favorable outcome' : sentiment === 'bad' ? 'Adverse outcome' : 'Uncertain outcome';
  const tone = sentiment === 'good' ? 'lime' : sentiment === 'bad' ? 'danger' : 'neutral';
  const titleColor = sentiment === 'good' ? 'text-lime-200' : sentiment === 'bad' ? 'text-red-200' : 'text-slate-100';
  const iconStyle = sentiment === 'good'
    ? 'border-lime-300/40 bg-lime-400/10 text-lime-200'
    : sentiment === 'bad'
      ? 'border-red-300/40 bg-red-400/10 text-red-200'
      : 'border-slate-300/30 bg-slate-300/10 text-slate-200';

  useEffect(() => {
    if (sentiment === 'good') playSound('encounterGood');
    if (sentiment === 'bad') playSound('encounterBad');
  }, [sentiment]);

  const handleDismiss = useCallback(() => {
    playSound('uiClick');
    onDismiss();
  }, [onDismiss]);

  return (
    <ScreenShell titleId={titleId} onDismiss={handleDismiss} contentClassName="justify-center">
      <GlassPanel
        tone={tone}
        data-sentiment={sentiment}
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        className="my-auto w-full max-w-xl p-5 text-left sm:p-7"
      >
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${iconStyle}`}>
            <OutcomeIcon className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <Badge tone={tone}>{sentimentLabel}</Badge>
            <h2 id={titleId} className={`mt-2 text-2xl font-black leading-tight sm:text-3xl ${titleColor}`}>
              {outcome.title}
            </h2>
          </div>
        </div>

        <p className="mt-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-200 sm:text-base">
          {outcome.text}
        </p>

        {details.length > 0 && (
          <ul className="mt-5 divide-y divide-white/10 border-y border-white/10" aria-label="Outcome changes">
            {details.map((detail) => {
              const DetailIcon = detail.tone === 'gain' ? ArrowUpRight : detail.tone === 'loss' ? ArrowDownRight : CircleMinus;
              const detailColor = detail.tone === 'gain' ? 'text-lime-200' : detail.tone === 'loss' ? 'text-red-300' : 'text-violet-200';
              return (
                <li key={detail.key} className={`flex min-h-11 items-center gap-3 py-2 text-sm font-bold sm:text-base ${detailColor}`}>
                  <DetailIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{detail.label}</span>
                </li>
              );
            })}
          </ul>
        )}

        <NeonButton
          onClick={handleDismiss}
          iconAfter={<ChevronRight className="h-4 w-4" />}
          fullWidth
          className="mt-6 sm:ml-auto sm:w-auto sm:min-w-40"
        >
          Continue
        </NeonButton>
      </GlassPanel>
    </ScreenShell>
  );
};
