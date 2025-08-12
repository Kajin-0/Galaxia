import React, { useEffect } from 'react';
import { playSound } from '../../sounds';
import { OutcomeResult } from '../../types';
import { ScreenOverlay } from './shared';

const getOutcomeSentiment = (outcome: OutcomeResult): 'good' | 'bad' | 'neutral' => {
    if (outcome.unlocksTrident) return 'good';

    switch (outcome.type) {
        case 'gain_items':
        case 'dialogue_reward':
        case 'fight_reward':
        case 'gain_consumables':
            return 'good';

        case 'trade':
            // If we gain parts or currency, it's a good trade. If not, it's a scam (bad).
            return (outcome.parts ?? 0) > 0 || (outcome.currency ?? 0) > 0 ? 'good' : 'bad';

        case 'level_skip':
            if ((outcome.levels ?? 0) > 0) return 'good';
            if ((outcome.levels ?? 0) < 0) return 'bad';
            return 'neutral';

        case 'lose_all_items':
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

    const getOutcomeDetails = () => {
        let details = [];
        if (outcome.currency) details.push(`${outcome.cost ? 'Gained' : ''} ${outcome.currency.toLocaleString()} currency`);
        if (outcome.cost) details.push(`Lost ${outcome.cost.toLocaleString()} currency`);
        if (outcome.parts) details.push(`Gained ${outcome.parts} Upgrade Parts`);
        if (outcome.levels) details.push(`Skipped ${outcome.levels} levels`);
        if (outcome.consumableQuantity && outcome.consumableType) details.push(`Gained ${outcome.consumableQuantity}x ${outcome.consumableType}`);
        if (outcome.unlocksTrident) details.push(`Unlocked: Trident Weapon System!`);
        return details.join(', ');
    };

    return (
        <ScreenOverlay>
            <div className={`max-w-xl w-full p-6 ${bgColor} border-4 ${borderColor} rounded-lg shadow-2xl`}>
                <h2 className={`text-3xl sm:text-4xl font-black mb-4 ${titleColor}`}>{outcome.title}</h2>
                <p className="text-base sm:text-lg text-slate-200 whitespace-pre-wrap">{outcome.text}</p>
                <p className="text-sm text-yellow-300 mt-2">{getOutcomeDetails()}</p>
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