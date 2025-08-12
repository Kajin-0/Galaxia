import React from 'react';
import type { InGameMessage } from '../../types';

interface InGameMessageOverlayProps {
    messages: InGameMessage[];
    now: number;
}

const messageStyles = {
    default: 'text-cyan-300',
    warning: 'text-yellow-400 font-bold',
    achievement: 'text-green-400 font-bold',
    boss: 'text-pink-500 font-black tracking-widest uppercase',
};

const InGameMessageItem: React.FC<{ message: InGameMessage }> = ({ message }) => {
    const baseStyle = 'text-2xl transition-all duration-500';
    const styleClass = messageStyles[message.style] || messageStyles.default;

    return (
        <div 
            key={message.id} 
            className={`${baseStyle} ${styleClass} animate-fade-in-out`}
            style={{
                textShadow: '0 0 8px rgba(0,0,0,0.8)',
                // @ts-ignore
                '--animation-duration': `${message.duration}ms`,
            }}
        >
            {message.text}
        </div>
    );
};


export const InGameMessageOverlay: React.FC<InGameMessageOverlayProps> = ({ messages, now }) => {
    const activeMessages = messages.filter(m => now < m.createdAt + m.duration);

    return (
        <div className="absolute bottom-32 left-0 right-0 flex flex-col items-center justify-center gap-2 z-30 pointer-events-none">
            {activeMessages.map(message => (
                <InGameMessageItem key={message.id} message={message} />
            ))}
        </div>
    );
};
