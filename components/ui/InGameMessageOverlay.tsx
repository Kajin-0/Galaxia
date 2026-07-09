import React from 'react';
import { Radio, Skull, TriangleAlert, Trophy, type LucideIcon } from 'lucide-react';
import type { InGameMessage } from '../../types';
import { GlassPanel, cx, type Tone } from './primitives';

interface InGameMessageOverlayProps {
    messages: InGameMessage[];
    now: number;
}

interface MessagePresentation {
    icon: LucideIcon;
    priority: number;
    tone: Tone;
    textClass: string;
    progressClass: string;
}

const messagePresentations: Record<InGameMessage['style'], MessagePresentation> = {
    default: {
        icon: Radio,
        priority: 0,
        tone: 'cyan',
        textClass: 'text-cyan-100',
        progressClass: 'bg-cyan-300',
    },
    achievement: {
        icon: Trophy,
        priority: 1,
        tone: 'lime',
        textClass: 'font-bold text-lime-100',
        progressClass: 'bg-lime-300',
    },
    warning: {
        icon: TriangleAlert,
        priority: 2,
        tone: 'gold',
        textClass: 'font-bold text-yellow-100',
        progressClass: 'bg-yellow-300',
    },
    boss: {
        icon: Skull,
        priority: 3,
        tone: 'magenta',
        textClass: 'font-black uppercase text-pink-100',
        progressClass: 'bg-pink-300',
    },
};

type MessageAnimationStyle = React.CSSProperties & {
    '--animation-duration': string;
};

const InGameMessageItem: React.FC<{ message: InGameMessage; now: number }> = ({ message, now }) => {
    const presentation = messagePresentations[message.style];
    const Icon = presentation.icon;
    const remaining = Math.max(0, message.createdAt + message.duration - now);
    const remainingFraction = message.duration > 0 ? Math.min(1, remaining / message.duration) : 0;

    return (
        <GlassPanel
            tone={presentation.tone}
            className="h-16 w-full animate-fade-in-out px-3 py-2"
            style={{ '--animation-duration': `${message.duration}ms` } as MessageAnimationStyle}
        >
            <div className="grid grid-cols-[20px_minmax(0,1fr)] items-center gap-2">
                <Icon size={18} className={presentation.textClass} aria-hidden="true" />
                <p className={cx('line-clamp-2 text-sm leading-4 tracking-wide', presentation.textClass)}>
                    {message.text}
                </p>
            </div>
            <div className="mt-2 h-0.5 overflow-hidden bg-slate-800" aria-hidden="true">
                <div
                    className={cx('h-full origin-left transition-transform duration-75 ease-linear', presentation.progressClass)}
                    style={{ transform: `scaleX(${remainingFraction})` }}
                />
            </div>
        </GlassPanel>
    );
};

export const InGameMessageOverlay: React.FC<InGameMessageOverlayProps> = ({ messages, now }) => {
    const activeMessages = messages
        .filter((message) => now < message.createdAt + message.duration)
        .sort((left, right) => (
            messagePresentations[right.style].priority - messagePresentations[left.style].priority
            || right.createdAt - left.createdAt
            || right.id - left.id
        ))
        .slice(0, 3);

    return (
        <div
            className="pointer-events-none absolute inset-x-0 z-30 flex h-[13rem] flex-col items-center justify-end gap-1.5 px-4"
            style={{
                bottom: 'calc(9rem + env(safe-area-inset-bottom, 0px))',
                paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
                paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
            }}
            role="status"
            aria-live="polite"
            aria-atomic="false"
            aria-relevant="additions text"
        >
            <div className="flex w-[min(100%,24rem)] flex-col gap-1.5">
                {activeMessages.map((message) => (
                    <InGameMessageItem key={message.id} message={message} now={now} />
                ))}
            </div>
        </div>
    );
};
