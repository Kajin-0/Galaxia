import React, { useEffect, useId, useRef } from 'react';

export const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

type Tone = 'cyan' | 'violet' | 'magenta' | 'gold' | 'lime' | 'danger' | 'neutral';

const toneClasses: Record<Tone, { border: string; text: string; fill: string; glow: string }> = {
  cyan: {
    border: 'border-cyan-400/35',
    text: 'text-cyan-200',
    fill: 'bg-cyan-400',
    glow: 'shadow-neon-cyan',
  },
  violet: {
    border: 'border-violet-400/35',
    text: 'text-violet-200',
    fill: 'bg-violet-400',
    glow: 'shadow-neon-violet',
  },
  magenta: {
    border: 'border-pink-400/40',
    text: 'text-pink-200',
    fill: 'bg-pink-400',
    glow: 'shadow-neon-magenta',
  },
  gold: {
    border: 'border-yellow-300/40',
    text: 'text-yellow-200',
    fill: 'bg-yellow-300',
    glow: 'shadow-[0_0_20px_rgba(250,204,21,0.2)]',
  },
  lime: {
    border: 'border-lime-400/35',
    text: 'text-lime-200',
    fill: 'bg-lime-400',
    glow: 'shadow-[0_0_20px_rgba(163,230,53,0.18)]',
  },
  danger: {
    border: 'border-red-400/40',
    text: 'text-red-200',
    fill: 'bg-red-400',
    glow: 'shadow-[0_0_20px_rgba(248,113,113,0.2)]',
  },
  neutral: {
    border: 'border-slate-400/25',
    text: 'text-slate-200',
    fill: 'bg-slate-300',
    glow: 'shadow-[0_0_18px_rgba(148,163,184,0.12)]',
  },
};

interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  interactive?: boolean;
}

export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(function GlassPanel(
  { className, tone = 'neutral', interactive = false, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cx(
        'glass-panel rounded-md',
        toneClasses[tone].border,
        interactive && 'transition-[transform,border-color,box-shadow] duration-200 ease-expo hover:-translate-y-0.5',
        className,
      )}
      {...props}
    >
      <div className="relative z-[1]">{children}</div>
    </div>
  );
});

type NeonButtonVariant = 'primary' | 'secondary' | 'danger' | 'quiet';

interface NeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: NeonButtonVariant;
  icon?: React.ReactNode;
  iconAfter?: React.ReactNode;
  fullWidth?: boolean;
}

const buttonVariants: Record<NeonButtonVariant, string> = {
  primary: 'neon-button-energy border-cyan-200/70 text-slate-950 hover:bg-cyan-200 active:bg-cyan-300',
  secondary: 'border-cyan-300/35 bg-slate-800/80 text-cyan-100 hover:border-cyan-300/65 hover:bg-slate-700/90',
  danger: 'border-red-300/45 bg-red-950/75 text-red-100 hover:border-red-300/75 hover:bg-red-900/80',
  quiet: 'border-slate-500/25 bg-slate-900/55 text-slate-200 hover:border-slate-300/40 hover:bg-slate-800/75',
};

export const NeonButton = React.forwardRef<HTMLButtonElement, NeonButtonProps>(function NeonButton(
  { className, variant = 'primary', icon, iconAfter, fullWidth = false, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'relative inline-flex min-h-11 items-center justify-center gap-2 overflow-hidden rounded-md border px-5 py-3 text-sm font-black uppercase tracking-wider',
        'transition-[transform,background-color,border-color,box-shadow,opacity] duration-150 ease-expo active:scale-[0.97]',
        'disabled:cursor-not-allowed disabled:border-slate-700/60 disabled:bg-slate-800/90 disabled:text-slate-500 disabled:shadow-none',
        buttonVariants[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {icon && <span className="shrink-0" aria-hidden="true">{icon}</span>}
      <span className="truncate">{children}</span>
      {iconAfter && <span className="shrink-0" aria-hidden="true">{iconAfter}</span>}
    </button>
  );
});

interface StatBarProps {
  value: number;
  max?: number;
  label?: string;
  valueLabel?: string;
  tone?: Tone;
  segments?: number;
  className?: string;
  compact?: boolean;
}

export const StatBar: React.FC<StatBarProps> = ({
  value,
  max = 100,
  label,
  valueLabel,
  tone = 'cyan',
  segments = 1,
  className,
  compact = false,
}) => {
  const percentage = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  const safeSegments = Math.max(1, Math.min(12, Math.round(segments)));

  return (
    <div className={cx('w-full', className)}>
      {(label || valueLabel) && (
        <div className={cx('mb-1 flex items-end justify-between gap-3 font-bold uppercase', compact ? 'text-[10px]' : 'text-xs')}>
          <span className={toneClasses[tone].text}>{label}</span>
          <span className="font-mono text-slate-300">{valueLabel}</span>
        </div>
      )}
      <div
        className={cx('relative overflow-hidden border bg-slate-950/80', compact ? 'h-1.5' : 'h-2.5', toneClasses[tone].border)}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(max, Math.max(0, value))}
      >
        <div
          className={cx('h-full origin-left transition-transform duration-300 ease-expo', toneClasses[tone].fill, toneClasses[tone].glow)}
          style={{ transform: `scaleX(${percentage / 100})` }}
        />
        {safeSegments > 1 && (
          <div
            className="absolute inset-0"
            aria-hidden="true"
            style={{
              backgroundImage: `repeating-linear-gradient(90deg, transparent 0 calc(${100 / safeSegments}% - 1px), rgba(2,6,23,.9) calc(${100 / safeSegments}% - 1px) ${100 / safeSegments}%)`,
            }}
          />
        )}
      </div>
    </div>
  );
};

interface CurrencyChipProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: Tone;
  className?: string;
}

export const CurrencyChip: React.FC<CurrencyChipProps> = ({ icon, label, value, tone = 'cyan', className }) => (
  <div className={cx('inline-flex min-h-9 items-center gap-2 rounded-md border bg-slate-950/65 px-3 py-1.5', toneClasses[tone].border, className)}>
    <span className={cx('shrink-0', toneClasses[tone].text)} aria-hidden="true">{icon}</span>
    <span className="sr-only">{label}: </span>
    <span className="font-mono text-sm font-bold tabular-nums text-slate-100">{value}</span>
  </div>
);

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({ tone = 'neutral', pulse = false, className, children, ...props }) => (
  <span
    className={cx(
      'inline-flex min-h-6 items-center gap-1 rounded border bg-slate-950/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
      toneClasses[tone].border,
      toneClasses[tone].text,
      pulse && 'animate-pulse',
      className,
    )}
    {...props}
  >
    {children}
  </span>
);

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  tone?: Tone;
  className?: string;
  icon?: React.ReactNode;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, label, description, disabled, tone = 'cyan', className, icon }) => (
  <label className={cx('flex min-h-11 cursor-pointer items-center justify-between gap-4', disabled && 'cursor-not-allowed opacity-50', className)}>
    <span className="flex min-w-0 items-center gap-2.5 text-left">
      {icon && <span className={cx('shrink-0', toneClasses[tone].text)} aria-hidden="true">{icon}</span>}
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold text-slate-100">{label}</span>
        {description && <span className="block truncate text-xs leading-snug text-slate-400">{description}</span>}
      </span>
    </span>
    <input
      type="checkbox"
      className="peer sr-only"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      disabled={disabled}
    />
    <span
      className={cx(
        'relative h-6 w-11 shrink-0 rounded-full border border-slate-500/50 bg-slate-900 transition-colors',
        'after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-slate-300 after:transition-transform',
        'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cyan-300',
        checked && `${toneClasses[tone].fill} after:translate-x-5 after:bg-white`,
      )}
      aria-hidden="true"
    />
  </label>
);

interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  valueLabel?: string;
}

export const Slider: React.FC<SliderProps> = ({ label, valueLabel, id: providedId, className, ...props }) => {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <label htmlFor={id} className={cx('block', className)}>
      <span className="mb-2 flex items-center justify-between gap-3 text-sm font-bold text-slate-100">
        <span>{label}</span>
        {valueLabel && <span className="font-mono text-xs text-cyan-200">{valueLabel}</span>}
      </span>
      <input
        id={id}
        type="range"
        className="h-11 w-full cursor-pointer accent-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
        {...props}
      />
    </label>
  );
};

interface ScreenShellProps extends React.HTMLAttributes<HTMLDivElement> {
  modal?: boolean;
  titleId?: string;
  onDismiss?: () => void;
  dim?: 'none' | 'soft' | 'strong';
  contentClassName?: string;
}

export const ScreenShell: React.FC<ScreenShellProps> = ({
  children,
  className,
  contentClassName,
  modal = true,
  titleId,
  onDismiss,
  dim = 'strong',
  ...props
}) => {
  const shellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!modal) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = shellRef.current;
    const focusable = root?.querySelector<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onDismiss) {
        event.preventDefault();
        onDismiss();
        return;
      }
      if (event.key !== 'Tab' || !root) return;
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )) as HTMLElement[];
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [modal, onDismiss]);

  const dimClass = dim === 'none' ? '' : dim === 'soft' ? 'bg-slate-950/45' : 'bg-slate-950/78';

  return (
    <div
      ref={shellRef}
      role={modal ? 'dialog' : 'region'}
      aria-modal={modal || undefined}
      aria-labelledby={titleId}
      className={cx(
        'screen-vignette absolute inset-0 z-20 flex min-h-0 flex-col text-white pointer-events-auto',
        dimClass,
        className,
      )}
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
      }}
      {...props}
    >
      <div className={cx('screen-shell-enter flex min-h-0 w-full flex-1 flex-col items-center overflow-y-auto overscroll-contain', contentClassName)}>
        {children}
      </div>
    </div>
  );
};

export type { Tone };
