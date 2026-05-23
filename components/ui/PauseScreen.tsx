import React, { useState } from 'react';
import { playSound } from '../../sounds';
import { ScreenOverlay } from './shared';
import type { GameAction } from '../../types';

export const PauseScreen: React.FC<{ 
    dispatch: React.Dispatch<GameAction>;
    currentLayout: 'right' | 'left';
    musicVolume: number;
    sfxVolume: number;
    hapticsEnabled: boolean;
}> = ({ dispatch, currentLayout, musicVolume, sfxVolume, hapticsEnabled }) => {
    const [showConfirm, setShowConfirm] = useState(false);
    
    const handleMusicChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const level = parseFloat(e.target.value);
        dispatch({ type: 'SET_VOLUME', volumeType: 'music', level });
    };

    const handleSfxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const level = parseFloat(e.target.value);
        dispatch({ type: 'SET_VOLUME', volumeType: 'sfx', level });
    };

    const handleToggleHaptics = () => {
        playSound('uiClick');
        dispatch({ type: 'TOGGLE_HAPTICS' });
    };
    
    const handleReturnToMenuClick = () => {
        playSound('uiClick');
        setShowConfirm(true);
    };

    const handleConfirmExit = () => {
        playSound('uiClick');
        dispatch({ type: 'EXIT_RUN_AND_SAVE' });
    };

    const handleCancelExit = () => {
        playSound('uiClick');
        setShowConfirm(false);
    };
    
    return (
        <ScreenOverlay>
          <h2 className="text-5xl sm:text-6xl font-bold uppercase text-yellow-400" style={{ textShadow: '0 0 15px #ff0' }}>
            Paused
          </h2>
          <div className="mt-8 flex flex-col gap-4">
              <button
                onClick={() => {
                  playSound('uiClick');
                  dispatch({ type: 'TOGGLE_PAUSE', timestamp: performance.now() });
                }}
                className="px-8 py-4 text-xl sm:text-2xl font-bold text-slate-900 bg-cyan-400 rounded-lg shadow-lg shadow-cyan-500/30 transition-all
                           hover:bg-cyan-300 hover:shadow-xl hover:shadow-cyan-400/50 focus:outline-none focus:ring-4 focus:ring-cyan-500 transform hover:scale-105"
              >
                Resume
              </button>
              <button
                onClick={handleReturnToMenuClick}
                className="px-8 py-4 text-xl sm:text-2xl font-bold text-white bg-pink-600 rounded-lg shadow-lg shadow-pink-800/30 transition-all
                           hover:bg-pink-500 hover:shadow-xl hover:shadow-pink-700/50 focus:outline-none focus:ring-4 focus:ring-pink-500"
              >
                Return to Menu
              </button>
          </div>
          <div className="mt-8 w-full max-w-xs space-y-4">
              <div>
                <label htmlFor="music-volume" className="block text-lg font-bold text-slate-300">Music Volume</label>
                <input
                  id="music-volume"
                  type="range"
                  min="0"
                  max="0.8"
                  step="0.05"
                  value={musicVolume}
                  onChange={handleMusicChange}
                  className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer range-thumb-cyan"
                  aria-label="Music Volume"
                />
              </div>
              <div>
                <label htmlFor="sfx-volume" className="block text-lg font-bold text-slate-300">SFX Volume</label>
                <input
                  id="sfx-volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={sfxVolume}
                  onChange={handleSfxChange}
                  className="w-full h-3 bg-slate-700 rounded-lg appearance-none cursor-pointer range-thumb-cyan"
                  aria-label="Sound Effects Volume"
                />
              </div>
          </div>
          <div className="mt-4 flex flex-col gap-2">
              <button
                onClick={() => {
                    playSound('uiClick');
                    dispatch({ type: 'TOGGLE_CONTROL_LAYOUT' });
                }}
                className="px-6 py-3 text-lg font-bold text-white bg-slate-700 rounded-lg shadow-lg shadow-slate-800/30 transition-all
                           hover:bg-slate-600 focus:outline-none focus:ring-4 focus:ring-slate-500"
              >
                Controls: {currentLayout === 'right' ? 'Right-Handed' : 'Left-Handed'}
              </button>
               <button
                onClick={handleToggleHaptics}
                className="px-6 py-3 text-lg font-bold text-white bg-slate-700 rounded-lg shadow-lg shadow-slate-800/30 transition-all
                           hover:bg-slate-600 focus:outline-none focus:ring-4 focus:ring-slate-500"
              >
                Haptics: {hapticsEnabled ? 'Enabled' : 'Disabled'}
              </button>
          </div>

          {showConfirm && (
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col justify-center items-center z-30 p-4">
                <div className="bg-slate-800 p-8 rounded-lg border-2 border-pink-500 shadow-2xl shadow-pink-500/20 text-center">
                    <h3 className="text-2xl font-bold text-white">Return to Menu?</h3>
                    <p className="mt-4 text-slate-300 max-w-sm">
                        You will keep any Currency, Upgrade Parts, and Rare Consumables earned this run.
                        <br/>
                        <span className="font-bold text-yellow-400">Your score will not be saved, and active flight consumables (Revive, etc.) will be lost.</span>
                    </p>
                    <div className="mt-6 flex justify-center gap-4">
                        <button onClick={handleConfirmExit} className="px-6 py-3 text-lg font-bold text-white bg-pink-600 rounded-lg hover:bg-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-400">
                            Yes, Exit Run
                        </button>
                        <button onClick={handleCancelExit} className="px-6 py-3 text-lg font-bold text-slate-900 bg-slate-300 rounded-lg hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
          )}

          <style>{`
            .range-thumb-cyan::-webkit-slider-thumb {
                -webkit-appearance: none;
                appearance: none;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: #22d3ee;
                cursor: pointer;
                border: 2px solid #06b6d4;
            }
            .range-thumb-cyan::-moz-range-thumb {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #22d3ee;
                cursor: pointer;
                border: 2px solid #06b6d4;
            }
          `}</style>
        </ScreenOverlay>
      );
};