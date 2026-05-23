import React from 'react';
import { playSound } from '../../sounds';
import { ScreenOverlay } from './shared';
import type { GameAction } from '../../types';

interface VictoryScreenProps {
  dispatch: React.Dispatch<GameAction>;
  score: number;
}

export const VictoryScreen: React.FC<VictoryScreenProps> = ({ dispatch, score }) => (
  <ScreenOverlay>
    <h2 className="text-6xl sm:text-7xl font-bold uppercase text-yellow-300" style={{ textShadow: '0 0 15px #ff0' }}>
      VICTORY
    </h2>
    <p className="mt-4 text-xl sm:text-2xl text-slate-200 max-w-lg">
        You have shattered the Overmind, the nexus of the invasion fleet. Its psychic scream echoes into silence, and across the galaxy, the armada falters and falls into disarray.
    </p>
    <p className="mt-2 text-xl sm:text-2xl text-slate-200">
        Your name will be remembered for eternity, hero.
    </p>
    <p className="mt-4 text-3xl sm:text-4xl text-slate-200">Final Score: {score.toLocaleString()}</p>
    
    <div className="mt-12 flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => {
            playSound('uiClick');
            dispatch({ type: 'CONTINUE_AFTER_VICTORY' });
          }}
          className="px-8 py-4 text-xl sm:text-2xl font-bold text-slate-900 bg-cyan-400 rounded-lg shadow-lg shadow-cyan-500/30 transition-all
                     hover:bg-cyan-300 hover:shadow-xl hover:shadow-cyan-400/50 focus:outline-none focus:ring-4 focus:ring-cyan-500 transform hover:scale-105"
        >
          Continue Playing
        </button>
        <button
          onClick={() => {
            playSound('uiClick');
            dispatch({ type: 'RETURN_TO_MENU' });
          }}
          className="px-8 py-4 text-xl sm:text-2xl font-bold text-white bg-slate-700 rounded-lg shadow-lg shadow-slate-800/30 transition-all
                     hover:bg-slate-600 hover:shadow-xl hover:shadow-slate-700/50 focus:outline-none focus:ring-4 focus:ring-slate-500 transform hover:scale-105"
        >
          Main Menu
        </button>
    </div>
  </ScreenOverlay>
);
