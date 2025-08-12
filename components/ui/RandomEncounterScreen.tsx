import React, { useEffect } from 'react';
import { playSound } from '../../sounds';
import { Encounter, PossibleOutcome, ConsumableItem } from '../../types';
import { ScreenOverlay } from './shared';

interface RandomEncounterScreenProps {
    encounter: Encounter;
    onChoose: (outcomes: PossibleOutcome[]) => void;
    totalCurrency: number;
    ownedRevives: number;
    ownedFastReloads: number;
    ownedRapidFires: number;
    ownedSpeedBoosts: number;
}

export const RandomEncounterScreen: React.FC<RandomEncounterScreenProps> = ({ 
    encounter, onChoose, totalCurrency, ownedRevives, ownedFastReloads, ownedRapidFires, ownedSpeedBoosts 
}) => {
    
    useEffect(() => {
        playSound('secretFound'); // Re-use secret sound for encounter start
    }, []);

    const handleChoice = (outcomes: PossibleOutcome[]) => {
        playSound('uiClick');
        onChoose(outcomes);
    };

    const getOwnedCount = (type: ConsumableItem): number => {
        switch (type) {
            case 'revive': return ownedRevives;
            case 'fastReload': return ownedFastReloads;
            case 'rapidFire': return ownedRapidFires;
            case 'speedBoost': return ownedSpeedBoosts;
            default: return 0;
        }
    }

    return (
        <ScreenOverlay>
            <div className="max-w-2xl w-full p-6 bg-slate-900/80 border-2 border-purple-500 rounded-lg shadow-2xl shadow-purple-500/20">
                <h2 className="text-3xl sm:text-4xl font-black mb-4 text-purple-300">{encounter.title}</h2>
                <p className="text-base sm:text-lg text-slate-200 mb-6 whitespace-pre-wrap">{encounter.text}</p>
                <div className="flex flex-col items-center gap-4 w-full">
                    {encounter.isChoice ? (
                        encounter.choices?.map((choice, index) => {
                            const tradeOutcome = choice.outcomes.find(o => o.result.type === 'trade');
                            const cost = tradeOutcome?.result.cost ?? 0;
                            const costConsumableType = tradeOutcome?.result.costConsumableType;
                            const costConsumableQuantity = tradeOutcome?.result.costConsumableQuantity || 1;

                            let isDisabled = false;
                            if (cost > 0 && totalCurrency < cost) {
                                isDisabled = true;
                            }
                            if (costConsumableType && getOwnedCount(costConsumableType) < costConsumableQuantity) {
                                isDisabled = true;
                            }

                            return (
                                <button
                                    key={index}
                                    onClick={() => handleChoice(choice.outcomes)}
                                    disabled={isDisabled}
                                    className="w-full max-w-md px-6 py-4 text-lg sm:text-xl font-bold text-white bg-slate-700 rounded-lg shadow-lg shadow-slate-800/30 transition-all
                                             hover:bg-slate-600 hover:shadow-xl hover:shadow-slate-700/50 focus:outline-none focus:ring-4 focus:ring-slate-500 transform hover:scale-105
                                             disabled:cursor-not-allowed disabled:grayscale disabled:bg-slate-800 disabled:shadow-none disabled:text-slate-500"
                                >
                                    {choice.text}
                                    {cost > 0 && (
                                        <span className={!isDisabled ? 'text-yellow-300' : 'text-red-400'}> ({cost.toLocaleString()})</span>
                                    )}
                                    {costConsumableType && (
                                        <span className={!isDisabled ? 'text-cyan-300' : 'text-slate-500'}> (Requires 1)</span>
                                    )}
                                </button>
                            );
                        })
                    ) : (
                        <button
                            onClick={() => handleChoice(encounter.outcomes || [])}
                            className="w-full max-w-md px-6 py-4 text-lg sm:text-xl font-bold text-white bg-slate-700 rounded-lg shadow-lg shadow-slate-800/30 transition-all
                                         hover:bg-slate-600 hover:shadow-xl hover:shadow-slate-700/50 focus:outline-none focus:ring-4 focus:ring-slate-500 transform hover:scale-105"
                        >
                            Investigate
                        </button>
                    )}
                </div>
            </div>
        </ScreenOverlay>
    );
};