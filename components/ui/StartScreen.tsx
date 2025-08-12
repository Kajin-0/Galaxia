import React, { useState } from 'react';
import { playSound, initAudio } from '../../sounds';
import { HeroType, Consumables } from '../../types';
import * as C from '../../constants';
import { ScreenOverlay } from './shared';

// Minimalist previews for the hero selection UI
const AlphaPreview: React.FC = () => <div className="w-full h-full bg-slate-700" style={{ clipPath: 'polygon(50% 0, 100% 75%, 80% 100%, 20% 100%, 0 75%)' }}/>
const BetaPreview: React.FC = () => <div className="w-full h-full bg-slate-700" style={{ clipPath: 'polygon(50% 0, 70% 90%, 50% 100%, 30% 90%)' }}/>
const GammaPreview: React.FC = () => <div className="w-full h-full bg-slate-700" style={{ clipPath: 'polygon(50% 0, 100% 40%, 85% 100%, 15% 100%, 0 40%)' }}/>

interface HeroPreviewInfo {
    component: React.FC;
    name: string;
    description: string;
}

const heroPreviews: Record<HeroType, HeroPreviewInfo> = {
    alpha: { 
        component: AlphaPreview, 
        name: 'Alpha', 
        description: '+5% Critical Hit Chance' 
    },
    beta: { 
        component: BetaPreview, 
        name: 'Beta',
        description: 'Enhanced Agility' 
    },
    gamma: { 
        component: GammaPreview, 
        name: 'Gamma',
        description: '+25% Shield Chance on Level Up'
    },
};

interface StartScreenProps {
  onStart: (consumables: Consumables, isHardMode: boolean) => void;
  onGoToArmory: () => void;
  onGoToHangar: () => void;
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
}

export const StartScreen: React.FC<StartScreenProps> = ({ 
    onStart, onGoToArmory, onGoToHangar, highScore, unlockedHeroes, cumulativeScore, cumulativeLevels, 
    ownedRevives, ownedFastReloads, ownedRapidFires, ownedSpeedBoosts,
    selectedHero, onSelectHero, bossesDefeated, hardModeUnlocked
}) => {
  const [consumables, setConsumables] = useState<Consumables>({
      useRevive: false,
      useFastReload: false,
      useRapidFire: false,
      useSpeedBoost: false,
  });
  const [isHardMode, setIsHardMode] = useState(false);

  const handleConsumableChange = (consumable: keyof Consumables, value: boolean) => {
    setConsumables(prev => ({...prev, [consumable]: value}));
  };

  const heroUnlockStatus: Record<HeroType, { isUnlocked: boolean; requirement: string; progress: string; }> = {
    alpha: { isUnlocked: true, requirement: '', progress: '' },
    beta: {
        isUnlocked: unlockedHeroes.beta,
        requirement: `Unlock: Reach Total Level ${C.BETA_UNLOCK_LEVELS}`,
        progress: `Progress: ${Math.min(cumulativeLevels, C.BETA_UNLOCK_LEVELS)} / ${C.BETA_UNLOCK_LEVELS}`
    },
    gamma: {
        isUnlocked: unlockedHeroes.gamma,
        requirement: `Unlock: Reach Total Score ${C.GAMMA_UNLOCK_SCORE.toLocaleString()}`,
        progress: `Progress: ${Math.min(cumulativeScore, C.GAMMA_UNLOCK_SCORE).toLocaleString()} / ${C.GAMMA_UNLOCK_SCORE.toLocaleString()}`
    }
  };

  const selectedHeroInfo = heroPreviews[selectedHero];
  const selectedHeroUnlockInfo = heroUnlockStatus[selectedHero];
  const canStart = selectedHeroUnlockInfo.isUnlocked;
  const hangarUnlocked = bossesDefeated > 0;

  const consumableChecks = [
      { id: 'useRevive', label: 'Use a Revive', owned: ownedRevives, color: 'text-pink-400' },
      { id: 'useFastReload', label: 'Use Adrenal Injector', owned: ownedFastReloads, color: 'text-yellow-400' },
      { id: 'useRapidFire', label: 'Use Overdrive Core', owned: ownedRapidFires, color: 'text-red-400' },
      { id: 'useSpeedBoost', label: 'Use Engine Coolant', owned: ownedSpeedBoosts, color: 'text-blue-400' },
  ] as const;

  return (
    <ScreenOverlay>
      <div className="overflow-y-auto w-full flex flex-col items-center pb-4">
        <h1 className="text-5xl md:text-6xl font-black uppercase tracking-widest text-cyan-300" style={{ textShadow: '0 0 15px #0ff' }}>
          Galaxia
        </h1>
        <div className="mt-2 flex items-center justify-center gap-6 text-slate-300 text-base sm:text-lg">
            <span>High Score: {highScore.toLocaleString()}</span>
        </div>
        
        {/* Hero Selection */}
        <div className="mt-6 w-full max-w-md">
            <h3 className="font-bold text-lg sm:text-xl text-cyan-300">Choose Your Hero:</h3>
            <div className="mt-4 flex justify-around items-start gap-4">
                {(Object.keys(heroPreviews) as HeroType[]).map(heroKey => {
                    const heroInfo = heroPreviews[heroKey];
                    const unlockInfo = heroUnlockStatus[heroKey];
                    const isSelected = selectedHero === heroKey;

                    return (
                        <div key={heroKey} className="flex flex-col items-center gap-2 w-32 text-center cursor-pointer"
                            onClick={() => {
                                initAudio();
                                playSound('uiClick');
                                onSelectHero(heroKey);
                            }}
                        >
                            <div
                                className={`p-2 border-4 rounded-lg transition-all duration-200 relative ${isSelected ? 'border-cyan-400 bg-cyan-900/50' : 'border-slate-600 hover:border-slate-400'} ${!unlockInfo.isUnlocked ? 'grayscale' : ''}`}
                            >
                                <div style={{ width: 60, height: 60 }}>
                                    <heroInfo.component />
                                </div>
                                {!unlockInfo.isUnlocked && (
                                     <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-slate-200" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                                )}
                            </div>
                            <span className={`font-bold transition-colors text-sm sm:text-base ${isSelected ? 'text-cyan-300' : 'text-slate-400'}`}>{heroInfo.name}</span>
                        </div>
                    );
                })}
            </div>
        </div>

        {/* Description / Unlock Info Area */}
        <div className="mt-1 h-12 flex flex-col items-center justify-center text-center">
            {selectedHeroUnlockInfo.isUnlocked ? (
                <p className="text-sm px-1 text-slate-300 transition-opacity duration-300">
                    {selectedHeroInfo.description}
                </p>
            ) : (
                <div className="text-sm text-yellow-300 font-semibold">
                    <p>{selectedHeroUnlockInfo.requirement}</p>
                    <p className="text-xs text-yellow-400/80">{selectedHeroUnlockInfo.progress}</p>
                </div>
            )}
        </div>
        
        {/* Pre-game options */}
        <div className="mt-4 w-full max-w-md p-4 bg-slate-800/50 rounded-lg border border-slate-600">
            <h3 className="font-bold text-lg sm:text-xl text-cyan-300">Pre-flight Check</h3>
            <div className="mt-3 space-y-2">
                {consumableChecks.map(item => {
                    const isChecked = consumables[item.id];
                    const remaining = item.owned - (isChecked ? 1 : 0);
                    return (
                        <label key={item.id} className={`flex items-center justify-center p-3 rounded-md transition-colors text-sm sm:text-base ${item.owned > 0 ? 'cursor-pointer bg-slate-700/50 hover:bg-slate-700' : 'bg-slate-900/50 grayscale'}`}>
                            <input 
                                type="checkbox"
                                className="h-5 w-5 rounded bg-slate-900 border-slate-600 text-cyan-500 focus:ring-cyan-600 disabled:opacity-50"
                                checked={isChecked}
                                onChange={(e) => handleConsumableChange(item.id, e.target.checked)}
                                disabled={item.owned === 0}
                                aria-label={item.label}
                            />
                            <span className="ml-3 text-slate-300 flex-grow text-left">{item.label}</span>
                            <span className={`ml-2 font-bold ${isChecked && item.owned > 0 ? item.color : 'text-slate-500'}`}>
                                ({item.owned > 0 ? remaining : 0} left)
                            </span>
                        </label>
                    );
                })}
                {hardModeUnlocked && (
                    <label className="flex items-center justify-center p-3 rounded-md transition-colors text-sm sm:text-base cursor-pointer bg-slate-700/50 hover:bg-slate-700 mt-2 border-2 border-pink-500/80">
                        <input 
                            type="checkbox"
                            className="h-5 w-5 rounded bg-slate-900 border-slate-600 text-pink-500 focus:ring-pink-600"
                            checked={isHardMode}
                            onChange={(e) => setIsHardMode(e.target.checked)}
                            aria-label="Enable Hard Mode"
                        />
                        <span className="ml-3 text-pink-300 flex-grow text-left font-bold uppercase tracking-wider">Hard Mode</span>
                        <span className="ml-2 font-bold text-pink-400/80">
                            (Increased Difficulty)
                        </span>
                    </label>
                )}
            </div>
        </div>


        <div className="mt-6 grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                initAudio();
                playSound('uiClick');
                onGoToArmory();
              }}
              className="px-6 py-4 text-lg sm:text-xl font-bold text-white bg-slate-700 rounded-lg shadow-lg shadow-slate-800/30 transition-all
                         hover:bg-slate-600 hover:shadow-xl hover:shadow-slate-700/50 focus:outline-none focus:ring-4 focus:ring-slate-500 transform hover:scale-105"
            >
              Armory
            </button>
            <button
              onClick={() => {
                initAudio();
                playSound('uiClick');
                onGoToHangar();
              }}
              disabled={!hangarUnlocked}
              className="px-6 py-4 text-lg sm:text-xl font-bold text-white bg-slate-700 rounded-lg shadow-lg shadow-slate-800/30 transition-all
                         hover:bg-slate-600 hover:shadow-xl hover:shadow-slate-700/50 focus:outline-none focus:ring-4 focus:ring-slate-500 transform hover:scale-105
                         disabled:cursor-not-allowed disabled:grayscale disabled:bg-slate-800 disabled:shadow-none disabled:text-slate-500 relative"
            >
              Hangar
              {!hangarUnlocked && <span className="absolute -top-2 -right-2 text-xs bg-yellow-500 text-black font-bold px-2 py-0.5 rounded-full">LOCKED</span>}
            </button>
            <button
              onClick={() => {
                initAudio(); // Initialize audio on the first user interaction.
                playSound('uiClick');
                onStart(consumables, isHardMode);
              }}
              disabled={!canStart}
              className="col-span-2 px-8 py-4 text-xl sm:text-2xl font-bold rounded-lg shadow-lg transition-all transform focus:outline-none focus:ring-4
                         disabled:cursor-not-allowed disabled:grayscale disabled:bg-slate-600 disabled:shadow-none disabled:text-slate-400
                         text-slate-900 bg-cyan-400 shadow-cyan-500/30 hover:bg-cyan-300 hover:shadow-xl hover:shadow-cyan-400/50 focus:ring-cyan-500 hover:scale-105"
            >
              {canStart ? 'Start Game' : 'Hero Locked'}
            </button>
        </div>
      </div>
    </ScreenOverlay>
  );
}
