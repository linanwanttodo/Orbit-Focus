/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./client/src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        gh: {
          canvas:        '#000000',
          subtle:        '#0d1117',
          surface:       '#161b22',
          inset:         '#010409',
          border:        '#30363d',
          'border-muted':'#21262d',
          fg:            '#e6edf3',
          muted:         '#7d8590',
          subtle:        '#6e7681',
          accent:        '#58a6ff',
          'accent-emph': '#1f6feb',
          success:       '#3fb950',
          'success-emph':'#238636',
          danger:        '#f85149',
          'danger-emph': '#da3633',
          warning:       '#d29922',
        },
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
