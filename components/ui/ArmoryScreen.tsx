import React, { useState } from 'react';
import { playSound } from '../../sounds';
import { Consumables, GameStatus, GameAction } from '../../types';
import * as C from '../../constants';
import { ScreenOverlay, CurrencyIcon, CrystaliteIcon, AnimatedNumber, UpgradePartIcon } from './shared';

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

const ReviveIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-pink-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" /></svg>;
const FastReloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-yellow-400" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 10-2 0v1.586l-1.293-1.293a1 1 0 10-1.414 1.414L7.586 6H6a1 1 0 000 2h1.586l-1.293 1.293a1 1 0 101.414 1.414L9 9.414V11a1 1 0 102 0V9.414l1.293 1.293a1 1 0 101.414-1.414L12.414 8H14a1 1 0 100-2h-1.586l1.293-1.293a1 1 0 10-1.414-1.414L11 4.586V3z" /><path d="M5.293 7.293a1 1 0 011.414 0L8 8.586V7a1 1 0 112 0v1.586l1.293-1.293a1 1 0 111.414 1.414L11.414 10H13a1 1 0 110 2h-1.586l1.293 1.293a1 1 0 11-1.414 1.414L10 13.414V15a1 1 0 11-2 0v-1.586l-1.293 1.293a1 1 0 01-1.414-1.414L6.586 12H5a1 1 0 110-2h1.586l-1.293-1.293a1 1 0 010-1.414z" /></svg>;
const RapidFireIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-red-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>;
const SpeedBoostIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>;

export const ArmoryScreen: React.FC<ArmoryScreenProps> = ({ 
    dispatch, gameStatus,
    totalCurrency, crystalite, currencyEarnedThisRun, partsEarnedThisRun, ownedRevives, ownedFastReloads, ownedRapidFires, ownedSpeedBoosts, intermissionReward,
    hasPermanentRapidFire, hasRevive
}) => {
    const [consumables, setConsumables] = useState<Consumables>({
      useRevive: false,
      useFastReload: false,
      useRapidFire: false,
      useSpeedBoost: false,
    });
    const handleConsumableChange = (consumable: keyof Consumables, value: boolean) => {
        setConsumables(prev => ({...prev, [consumable]: value}));
    };

    const isIntermission = gameStatus === GameStatus.Intermission;

    const armoryItems = [
        { name: C.CONSUMABLE_NAMES.revive, type: 'revive', description: 'Instantly come back to life upon death.', cost: C.REVIVE_COST, crystaliteCost: C.CRYSTALITE_COST_REVIVE, owned: ownedRevives, onBuy: () => dispatch({ type: 'BUY_REVIVE' }), icon: <ReviveIcon/>, color: 'pink' },
        { name: C.CONSUMABLE_NAMES.fastReload, type: 'fastReload', description: 'Start your next run with 2 Reload Boost stacks.', cost: C.FAST_RELOAD_COST, crystaliteCost: C.CRYSTALITE_COST_FAST_RELOAD, owned: ownedFastReloads, onBuy: () => dispatch({ type: 'BUY_FAST_RELOAD' }), icon: <FastReloadIcon/>, color: 'yellow' },
        { name: C.CONSUMABLE_NAMES.rapidFire, type: 'rapidFire', description: 'Start your next run with permanent Rapid Fire.', cost: C.RAPID_FIRE_COST, crystaliteCost: C.CRYSTALITE_COST_RAPID_FIRE, owned: ownedRapidFires, onBuy: () => dispatch({ type: 'BUY_RAPID_FIRE' }), icon: <RapidFireIcon/>, color: 'red' },
        { name: C.CONSUMABLE_NAMES.speedBoost, type: 'speedBoost', description: 'Start your next run with a 25% speed boost.', cost: C.SPEED_BOOST_COST, crystaliteCost: C.CRYSTALITE_COST_SPEED_BOOST, owned: ownedSpeedBoosts, onBuy: () => dispatch({ type: 'BUY_SPEED_BOOST' }), icon: <SpeedBoostIcon/>, color: 'blue' },
    ] as const;
    
    const consumableChecks = [
      { id: 'useRevive', label: `Use a ${C.CONSUMABLE_NAMES.revive}`, owned: ownedRevives, color: 'text-pink-400' },
      { id: 'useFastReload', label: `Use an ${C.CONSUMABLE_NAMES.fastReload}`, owned: ownedFastReloads, color: 'text-yellow-400' },
      { id: 'useRapidFire', label: `Use an ${C.CONSUMABLE_NAMES.rapidFire}`, owned: ownedRapidFires, color: 'text-red-400' },
      { id: 'useSpeedBoost', label: `Use ${C.CONSUMABLE_NAMES.speedBoost}`, owned: ownedSpeedBoosts, color: 'text-blue-400' },
    ] as const;

    return (
        <ScreenOverlay>
            <div className="w-full h-full flex flex-col items-center">
                <h1 className="text-5xl md:text-6xl font-black uppercase tracking-widest text-cyan-300" style={{ textShadow: '0 0 15px #0ff' }}>
                    {isIntermission ? 'Intermission' : 'Armory'}
                </h1>
                <div className="mt-2 flex flex-col items-center justify-center gap-1 text-slate-300 text-base sm:text-lg">
                    <div className="flex items-center justify-center gap-4">
                        <span className="flex items-center gap-2 text-yellow-300 text-xl sm:text-2xl" title="Alien Currency">
                            <CurrencyIcon />
                            <AnimatedNumber value={totalCurrency} />
                        </span>
                         <span className="flex items-center gap-2 text-purple-400 text-xl sm:text-2xl" title="Crystalite">
                            <CrystaliteIcon />
                            <AnimatedNumber value={crystalite} />
                        </span>
                    </div>
                    {isIntermission && (currencyEarnedThisRun > 0 || partsEarnedThisRun > 0) && (
                        <div className="flex items-center justify-center gap-4 mt-1">
                            {currencyEarnedThisRun > 0 && (
                                <span className="text-yellow-300/80 text-sm sm:text-base">(+{currencyEarnedThisRun.toLocaleString()} this run)</span>
                            )}
                            {partsEarnedThisRun > 0 && (
                                <span className="text-orange-400/80 text-sm sm:text-base flex items-center gap-1">
                                    ( +{partsEarnedThisRun.toLocaleString()} <UpgradePartIcon className="h-4 w-4 inline-block" /> this run)
                                </span>
                            )}
                        </div>
                    )}
                </div>
                
                {isIntermission && intermissionReward && (
                     <div className="mt-4 w-full max-w-lg p-4 bg-green-900/50 border-2 border-green-400 rounded-lg text-center animate-pulse">
                        <h3 className="text-lg sm:text-xl font-bold text-green-300">SECTOR CLEAR BONUS!</h3>
                        <p className="mt-1 text-white">You were awarded a free <span className="font-bold">{intermissionReward.name}</span>!</p>
                    </div>
                )}

                {/* Items List */}
                <div className="mt-4 w-full max-w-lg flex-grow overflow-y-auto p-1 pr-2">
                    <div className="space-y-3">
                        {armoryItems.map(item => (
                            <div key={item.name} className="flex items-center bg-slate-800/70 p-3 rounded-lg border border-slate-600">
                                <div className="flex-shrink-0 w-12 h-12 flex items-center justify-center">
                                    {item.icon}
                                </div>
                                <div className="text-left ml-4 flex-grow">
                                    <p className={`font-bold text-base sm:text-lg text-${item.color}-300`}>{item.name}</p>
                                    <p className="text-sm text-slate-400">{item.description}</p>
                                    <p className={`text-sm text-${item.color}-400/80 mt-1`}>You own: {item.owned.toLocaleString()}</p>
                                </div>
                                <div className="ml-4 flex flex-col gap-2">
                                    <button
                                        onClick={() => { playSound('purchase'); item.onBuy(); }}
                                        disabled={totalCurrency < item.cost}
                                        className="w-full px-3 py-2 font-bold text-sm rounded-lg shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900
                                                   disabled:cursor-not-allowed disabled:grayscale disabled:bg-slate-600 disabled:shadow-none disabled:text-slate-400
                                                   text-slate-900 bg-yellow-400 shadow-yellow-500/30 hover:bg-yellow-300 hover:shadow-lg hover:shadow-yellow-400/40 focus:ring-yellow-500
                                                   flex items-center justify-center gap-1"
                                    >
                                        Buy <span className="flex items-center gap-1">({item.cost.toLocaleString()} <CurrencyIcon className="h-4 w-4"/>)</span>
                                    </button>
                                     <button
                                        onClick={() => { playSound('purchase'); dispatch({ type: 'BUY_CONSUMABLE_WITH_CRYSTALITE', item: item.type }); }}
                                        disabled={crystalite < item.crystaliteCost}
                                        className="w-full px-3 py-2 font-bold text-sm rounded-lg shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900
                                                   disabled:cursor-not-allowed disabled:grayscale disabled:bg-slate-600 disabled:shadow-none disabled:text-slate-400
                                                   text-slate-900 bg-purple-400 shadow-purple-500/30 hover:bg-purple-300 hover:shadow-lg hover:shadow-purple-400/40 focus:ring-purple-500
                                                   flex items-center justify-center gap-1"
                                    >
                                        Buy <span className="flex items-center gap-1">({item.crystaliteCost} <CrystaliteIcon className="h-4 w-4"/>)</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {isIntermission && (
                         <div className="mt-6 w-full max-w-lg p-4 bg-slate-800/50 rounded-lg border border-slate-600">
                            <h3 className="font-bold text-lg sm:text-xl text-cyan-300">Equip for Next Sector</h3>
                            <div className="mt-3 space-y-2">
                                {consumableChecks.map(item => {
                                    const isChecked = consumables[item.id];
                                    const remaining = item.owned - (isChecked ? 1 : 0);
                                    const isAlreadyActive = (item.id === 'useRevive' && !!hasRevive) || (item.id === 'useRapidFire' && !!hasPermanentRapidFire);
                                    const isDisabled = item.owned === 0 || isAlreadyActive;
                                    
                                    return (
                                        <label key={item.id} className={`flex items-center justify-center p-3 rounded-md transition-colors text-sm sm:text-base ${!isDisabled ? 'cursor-pointer bg-slate-700/50 hover:bg-slate-700' : 'bg-slate-900/50 grayscale'}`}>
                                            <input 
                                                type="checkbox"
                                                className="h-5 w-5 rounded bg-slate-900 border-slate-600 text-cyan-500 focus:ring-cyan-600 disabled:opacity-50"
                                                checked={isChecked}
                                                onChange={(e) => handleConsumableChange(item.id, e.target.checked)}
                                                disabled={isDisabled}
                                                aria-label={item.label}
                                            />
                                            <span className="ml-3 text-slate-300 flex-grow text-left">{item.label}</span>
                                            <span className={`ml-2 font-bold ${isChecked && !isDisabled ? item.color : 'text-slate-500'}`}>
                                                {isAlreadyActive ? '(ACTIVE)' : `(${item.owned > 0 ? remaining : 0} left)`}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {isIntermission ? (
                     <button
                        onClick={() => {
                            playSound('uiClick');
                            dispatch({ type: 'CONTINUE_GAME', consumables });
                        }}
                        className="mt-6 px-8 py-4 text-lg sm:text-xl font-bold text-slate-900 bg-cyan-400 rounded-lg shadow-lg shadow-cyan-500/30 transition-all
                                   hover:bg-cyan-300 hover:shadow-xl hover:shadow-cyan-400/50 focus:outline-none focus:ring-4 focus:ring-cyan-500 transform hover:scale-105"
                    >
                        Continue Run
                    </button>
                ) : (
                    <button
                      onClick={() => {
                        playSound('uiClick');
                        dispatch({ type: 'RETURN_TO_MENU' });
                      }}
                      className="mt-6 px-8 py-4 text-lg sm:text-xl font-bold text-white bg-slate-700 rounded-lg shadow-lg shadow-slate-800/30 transition-all
                                 hover:bg-slate-600 hover:shadow-xl hover:shadow-slate-700/50 focus:outline-none focus:ring-4 focus:ring-slate-500 transform hover:scale-105"
                    >
                      Back to Menu
                    </button>
                )}
            </div>
        </ScreenOverlay>
    );
};