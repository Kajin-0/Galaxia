import React from 'react';
import { playSound } from '../../sounds';
import { ScreenOverlay } from './shared';

interface GameOverScreenProps {
  onRestart: () => void;
  onReturnToMenu: () => void;
  score: number;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({ onRestart, onReturnToMenu, score }) => (
  <ScreenOverlay>
    <h2 className="text-6xl sm:text-7xl font-bold uppercase text-pink-500" style={{ textShadow: '0 0 15px #f0f' }}>
      Game Over
    </h2>
    <p className="mt-4 text-3xl sm:text-4xl text-slate-200">Final Score: {score}</p>
    <div className="mt-12 flex flex-col sm:flex-row gap-4">
        <button
          onClick={() => {
            playSound('uiClick');
            onRestart();
          }}
          className="px-8 py-4 text-xl sm:text-2xl font-bold text-slate-900 bg-cyan-400 rounded-lg shadow-lg shadow-cyan-500/30 transition-all
                     hover:bg-cyan-300 hover:shadow-xl hover:shadow-cyan-400/50 focus:outline-none focus:ring-4 focus:ring-cyan-500 transform hover:scale-105"
        >
          Restart
        </button>
        <button
          onClick={() => {
            playSound('uiClick');
            onReturnToMenu();
          }}
          className="px-8 py-4 text-xl sm:text-2xl font-bold text-white bg-slate-700 rounded-lg shadow-lg shadow-slate-800/30 transition-all
                     hover:bg-slate-600 hover:shadow-xl hover:shadow-slate-700/50 focus:outline-none focus:ring-4 focus:ring-slate-500 transform hover:scale-105"
        >
          Main Menu
        </button>
    </div>
  </ScreenOverlay>
);