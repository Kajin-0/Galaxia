import React, { useEffect } from 'react';
import { playSound } from '../../sounds';
import { OutcomeResult } from '../../types';
import { ScreenOverlay } from './shared';
import * as C from '../../constants';

const getOutcomeSentiment = (outcome: OutcomeResult): 'good' | 'bad' | 'neutral' => {
    if (outcome.unlocksTrident || outcome.gainHereticalInsight) return 'good';

    switch (outcome.type) {
        case 'gain_items':
        case 'dialogue_reward':
        case 'fight_reward':
        case 'gain_consumables':
        case 'gain_rare_consumable':
            return 'good';

        case 'trade':
            // If we gain parts or currency, it's a good trade. If not, it's a scam (bad).
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
            return 'neutral';

        // 'fight' type doesn't usually land on this screen, but if it does, treat as neutral for now.
        case 'fight':
            return 'neutral';
            
        default:
            return 'neutral';
    }
};

export const EncounterOutcomeScreen: React.FC<{ outcome: OutcomeResult, onDismiss: () => void }> = ({ outcome, onDismiss }) => {
    const sentiment = getOutcomeSentiment(outcome);
    const isGoodOutcome = sentiment === 'good';
    const isBadOutcome = sentiment === 'bad';

    const borderColor = isGoodOutcome ? 'border-green-400' : isBadOutcome ? 'border-red-400' : 'border-slate-400';
    const bgColor = isGoodOutcome ? 'bg-green-900/50' : isBadOutcome ? 'bg-red-900/50' : 'bg-slate-800/80';
    const titleColor = isGoodOutcome ? 'text-green-300' : isBadOutcome ? 'text-red-300' : 'text-slate-200';

    useEffect(() => {
        if (sentiment === 'good') {
            playSound('encounterGood');
        } else if (sentiment === 'bad') {
            playSound('encounterBad');
        }
        // No sound for 'neutral'
    }, [sentiment]);

    const renderOutcomeDetails = () => {
        const details: React.ReactNode[] = [];

        // --- Handle LOSSES first (all in red) ---
        if (outcome.cost) {
            details.push(<li key="cost-currency" className="text-red-400">-{outcome.cost.toLocaleString()} currency</li>);
        }
        if (outcome.costConsumableType && outcome.costConsumableQuantity) {
            const name = C.CONSUMABLE_NAMES[outcome.costConsumableType] || outcome.costConsumableType;
            details.push(<li key="cost-consumable" className="text-red-400">-{outcome.costConsumableQuantity}x {name}</li>);
        }
        if (outcome.currency && outcome.currency < 0) {
            details.push(<li key="lost-currency" className="text-red-400">-{Math.abs(outcome.currency).toLocaleString()} currency</li>);
        }
        if (outcome.levels && outcome.levels < 0) {
            details.push(<li key="lost-levels" className="text-red-400">{outcome.levels} levels</li>);
        }
        // Display specific lost items if available, otherwise show the generic count as a fallback.
        if (outcome.lostItems) {
            outcome.lostItems.forEach(item => {
                const name = C.CONSUMABLE_NAMES[item.type] || item.type;
                details.push(<li key={`lost-${item.type}`} className="text-red-400">-{item.quantity}x {name}</li>);
            });
        } else if (outcome.itemLossCount) {
             details.push(<li key="lost-items" className="text-red-400">-{outcome.itemLossCount} random consumables</li>);
        }

        // --- Handle GAINS (color-coded) ---
        if (outcome.currency && outcome.currency > 0) {
            details.push(<li key="gain-currency" className="text-yellow-300">+{outcome.currency.toLocaleString()} currency</li>);
        }
        if (outcome.parts) {
            details.push(<li key="gain-parts" className="text-orange-400">+{outcome.parts} Upgrade Parts</li>);
        }
        if (outcome.levels && outcome.levels > 0) {
            details.push(<li key="gain-levels" className="text-green-400">+{outcome.levels} level skip{outcome.levels > 1 ? 's' : ''}</li>);
        }
        if (outcome.consumableQuantity && outcome.consumableType) {
            const name = C.CONSUMABLE_NAMES[outcome.consumableType] || outcome.consumableType;
            details.push(<li key="gain-consumable" className="text-cyan-300">+{outcome.consumableQuantity}x {name}</li>);
        }
        if (outcome.rareConsumableType && outcome.rareConsumableShots) {
            details.push(<li key="gain-rare-consumable" className="text-pink-400 font-bold">Gained: {outcome.rareConsumableShots}x Corrosive Rounds</li>);
        }
        if (outcome.unlocksTrident) {
            details.push(<li key="unlock-trident" className="text-purple-400 font-bold">Unlocked: Trident Weapon System!</li>);
        }
         if (outcome.gainHereticalInsight) {
            details.push(<li key="unlock-insight" className="text-purple-400 font-bold">Gained: Heretical Insight</li>);
        }


        if (details.length === 0) {
            return null;
        }

        return (
            <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-600">
                <ul className="text-lg font-semibold space-y-1">
                    {details}
                </ul>
            </div>
        );
    };

    return (
        <ScreenOverlay>
            <div className={`max-w-xl w-full p-6 ${bgColor} border-4 ${borderColor} rounded-lg shadow-2xl`}>
                <h2 className={`text-3xl sm:text-4xl font-black mb-4 ${titleColor}`}>{outcome.title}</h2>
                <p className="text-base sm:text-lg text-slate-200 whitespace-pre-wrap">{outcome.text}</p>
                {renderOutcomeDetails()}
                <button
                    onClick={() => {
                        playSound('uiClick');
                        onDismiss();
                    }}
                    className="mt-6 px-8 py-3 text-lg sm:text-xl font-bold text-slate-900 bg-cyan-400 rounded-lg shadow-lg shadow-cyan-500/30 transition-all
                               hover:bg-cyan-300 hover:shadow-xl hover:shadow-cyan-400/50 focus:outline-none focus:ring-4 focus:ring-cyan-500 transform hover:scale-105"
                >
                    Continue
                </button>
            </div>
        </ScreenOverlay>
    );
};
