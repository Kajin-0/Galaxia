/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx}',
    './hooks/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        space: {
          void: 'rgb(var(--color-space-void) / <alpha-value>)',
          deep: 'rgb(var(--color-space-deep) / <alpha-value>)',
          panel: 'rgb(var(--color-space-panel) / <alpha-value>)',
          raised: 'rgb(var(--color-space-raised) / <alpha-value>)',
        },
        signal: {
          cyan: 'rgb(var(--color-signal-cyan) / <alpha-value>)',
          violet: 'rgb(var(--color-signal-violet) / <alpha-value>)',
          magenta: 'rgb(var(--color-signal-magenta) / <alpha-value>)',
          gold: 'rgb(var(--color-signal-gold) / <alpha-value>)',
          lime: 'rgb(var(--color-signal-lime) / <alpha-value>)',
          danger: 'rgb(var(--color-signal-danger) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['"Exo 2"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'neon-cyan': '0 0 0 1px rgb(34 211 238 / 0.25), 0 0 24px rgb(34 211 238 / 0.18)',
        'neon-violet': '0 0 0 1px rgb(167 139 250 / 0.25), 0 0 24px rgb(167 139 250 / 0.18)',
        'neon-magenta': '0 0 0 1px rgb(244 114 182 / 0.3), 0 0 26px rgb(244 114 182 / 0.2)',
      },
      transitionTimingFunction: {
        expo: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
