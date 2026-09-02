/** @type {import('tailwindcss').Config} */

// Design tokens for the simulator's control-room UI.
//
// One rule governs colour here: MOVING DATA IS SATURATED, STATIC CHROME IS
// MUTED. Order tokens crossing the board keep their full-strength hues so the
// eye tracks them; every static surface (panels, equipment cards, zone tags,
// legends) uses the desaturated `zone` ramp so thirteen competing hues stop
// fighting the four that actually carry information. Semantic red/amber/green
// are held in reserve for alarms, which is what lets an alarm read as one.
export default {
  content: ['./index.html', './simulator.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Surface elevation: darker is further back. Dark UI reads depth from
        // lightness, not from shadows, so each level is a real step.
        ink: {
          950: '#05080f', // app ground
          900: '#0a0f1b', // rails, dashboard, panels
          850: '#101828', // raised cards inside a panel
          800: '#182135', // hover / emphasis
          700: '#232e46', // hairline border
          600: '#31405e', // strong border
        },
        accent: {
          DEFAULT: '#4f8ef7',
          soft: '#8fb8ff',
          dim: '#1d3563',
        },
        // Static zone chrome, pulled to a shared chroma so no single zone shouts.
        zone: {
          inbound: '#3aa8bd',
          storage: '#5188cf',
          picking: '#3bab84',
          sort: '#9a7ad4',
          packing: '#cc7f45',
          outbound: '#c9902f',
        },
        // Reserved for state, never for decoration.
        ok: '#3ecf8e',
        warn: '#e5a53c',
        danger: '#ef5350',
        // Legacy aliases still referenced by the landing page.
        auto: '#22d3ee',
        manual: '#a78bfa',
        urgent: '#f59e0b',
      },
      fontFamily: {
        display: ['"Chakra Petch"', 'sans-serif'],
        body: ['"IBM Plex Sans"', '"Noto Sans KR"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      // A fixed type scale for the simulator UI. Every size in the control
      // room comes from this list; the `ui-` prefix keeps it from colliding
      // with Tailwind's defaults, which the landing page still uses.
      fontSize: {
        'ui-micro': ['10px', { lineHeight: '1.3', letterSpacing: '0.09em' }],
        'ui-meta': ['11px', { lineHeight: '1.35' }],
        'ui-body': ['12px', { lineHeight: '1.45' }],
        'ui-card': ['13px', { lineHeight: '1.35' }],
        'ui-lead': ['15px', { lineHeight: '1.35' }],
        'ui-head': ['18px', { lineHeight: '1.25' }],
        'ui-stat': ['22px', { lineHeight: '1.1' }],
        'ui-hero': ['30px', { lineHeight: '1.05' }],
      },
      boxShadow: {
        glow: '0 0 24px -4px rgba(79,142,247,.75)',
        panel: '0 18px 34px -22px rgba(0,0,0,.95)',
        card: '0 10px 18px -10px rgba(0,0,0,.8)',
      },
    },
  },
  plugins: [],
};
