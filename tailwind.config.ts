import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#bcd3ff',
          300: '#8eb6ff',
          400: '#598fff',
          500: '#2f66ff',
          600: '#1a44f5',
          700: '#1432e1',
          800: '#172bb6',
          900: '#192a8f',
          950: '#141b57',
        },
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5d9e2',
          300: '#b1b8c9',
          400: '#8791ab',
          500: '#687391',
          600: '#535c78',
          700: '#444b62',
          800: '#3b4153',
          900: '#343947',
          950: '#23262f',
        },
        accent: {
          400: '#ffb020',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(16,24,40,.06), 0 1px 3px 0 rgba(16,24,40,.1)',
        pop: '0 12px 32px -8px rgba(16,24,40,.18)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-in': { from: { opacity: '0', transform: 'translateX(12px)' }, to: { opacity: '1', transform: 'none' } },
      },
      animation: {
        'fade-in': 'fade-in .18s ease-out',
        'slide-in': 'slide-in .22s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
