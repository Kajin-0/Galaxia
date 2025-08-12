import React from 'react';
import { playSound } from '../../sounds';
import { ScreenOverlay } from './shared';

export const PauseScreen: React.FC<{ 
    onResume: () => void;
    onToggleLayout: () => void;
    currentLayout: 'right' | 'left';
}> = ({ onResume, onToggleLayout, currentLayout }) => (
    <ScreenOverlay>
      <h2 className="text-5xl sm:text-6xl font-bold uppercase text-yellow-400" style={{ textShadow: '0 0 15px #ff0' }}>
        Paused
      </h2>
      <button
        onClick={() => {
          playSound('uiClick');
          onResume();
        }}
        className="mt-8 px-8 py-4 text-xl sm:text-2xl font-bold text-slate-900 bg-cyan-400 rounded-lg shadow-lg shadow-cyan-500/30 transition-all
                   hover:bg-cyan-300 hover:shadow-xl hover:shadow-cyan-400/50 focus:outline-none focus:ring-4 focus:ring-cyan-500 transform hover:scale-105"
      >
        Resume
      </button>
      <button
        onClick={() => {
            playSound('uiClick');
            onToggleLayout();
        }}
        className="mt-4 px-6 py-3 text-lg font-bold text-white bg-slate-700 rounded-lg shadow-lg shadow-slate-800/30 transition-all
                   hover:bg-slate-600 focus:outline-none focus:ring-4 focus:ring-slate-500"
      >
        Controls: {currentLayout === 'right' ? 'Right-Handed' : 'Left-Handed'}
      </button>
      <p className="mt-2 text-xs text-slate-400 max-w-xs">
        Right-Handed: Buttons on left. Left-Handed: Buttons on right.
      </p>
    </ScreenOverlay>
  );