/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#05070d',
          900: '#0a0e1a',
          800: '#111827',
          700: '#1a2233',
        },
        accent: {
          DEFAULT: '#3b82f6',
          soft: '#60a5fa',
        },
        auto: '#22d3ee',
        manual: '#a78bfa',
        urgent: '#f59e0b',
        danger: '#ef4444',
        ok: '#34d399',
      },
      fontFamily: {
        display: ['"Chakra Petch"', 'sans-serif'],
        body: ['"IBM Plex Sans"', '"Noto Sans KR"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(59,130,246,.8)',
      },
    },
  },
  plugins: [],
};
