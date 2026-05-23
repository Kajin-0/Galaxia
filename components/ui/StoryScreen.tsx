import React from 'react';
import { playSound } from '../../sounds';
import { ScreenOverlay } from './shared';

interface StoryScreenProps {
  title: string;
  text: string;
  onDismiss: () => void;
}

export const StoryScreen: React.FC<StoryScreenProps> = ({ title, text, onDismiss }) => (
  <ScreenOverlay>
    <div className="max-w-xl w-full p-6 bg-slate-900/80 border-2 border-cyan-500 rounded-lg shadow-2xl shadow-cyan-500/20">
        <h2 className="text-3xl sm:text-4xl font-black mb-4 text-cyan-300">{title}</h2>
        <p className="text-base sm:text-lg text-slate-200 whitespace-pre-wrap">{text}</p>
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