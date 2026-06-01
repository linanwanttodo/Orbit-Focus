/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // GitHub Dark theme (Primer spec) — pure black background, line borders
        gh: {
          canvas:        '#000000',  // page background (pure black, OLED)
          subtle:        '#0d1117',  // subtle surface (cards)
          surface:       '#161b22',  // elevated surface (dropdowns, hover)
          inset:         '#010409',  // deepest inset
          border:        '#30363d',  // default 1px line border
          'border-muted':'#21262d',  // muted line border (dividers)
          fg:            '#e6edf3',  // primary text
          muted:         '#7d8590',  // muted text
          subtle:        '#6e7681',  // subtle/disabled text
          accent:        '#58a6ff',  // accent text
          'accent-emph': '#1f6feb',  // accent background
          success:       '#3fb950',
          'success-emph':'#238636',
          danger:        '#f85149',
          'danger-emph': '#da3633',
          warning:       '#d29922',
        },
        // Legacy aliases (kept for components that still reference old names)
        dark: {
          900: '#000000',
          800: '#0d1117',
          700: '#161b22',
          600: '#21262d',
        },
        brand: {
          DEFAULT: 'var(--brand-color)',
          hover: 'var(--brand-color-hover)',
          soft: 'var(--brand-color-soft)',
          shadow: 'var(--brand-color-shadow)',
        }
      }
    },
  },
  plugins: [],
}
