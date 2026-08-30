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
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
      colors: {
        // 项目既有设计令牌（不与 tailwind 核心工具类冲突）
        gh: {
          canvas:        'var(--gh-canvas)',
          base:          'var(--gh-base)',
          surface:       'var(--gh-surface)',
          inset:         'var(--gh-inset)',
          hover:         'var(--gh-hover)',
          border:        'var(--gh-border)',
          'border-muted':'var(--gh-border-muted)',
          fg:            'var(--gh-fg)',
          muted:         'var(--gh-muted)',
          subtle:        'var(--gh-subtle)',
          accent:        'var(--gh-accent)',
          'accent-emph': 'var(--gh-accent-emph)',
          success:       'var(--gh-success)',
          'success-emph':'var(--gh-success-emph)',
          danger:        'var(--gh-danger)',
          'danger-emph': 'var(--gh-danger-emph)',
          warning:       'var(--gh-warning)',
          error:         'var(--gh-danger)',
          'error-bg':    'rgba(242, 109, 109, 0.1)',
        },
        // shadcn/ui 语义令牌 — 桥接到现有 --gh-* 色板，单一事实来源
        border:        'var(--border)',
        input:         'var(--input)',
        ring:          'var(--ring)',
        background:    'var(--background)',
        foreground:    'var(--foreground)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          foreground: 'var(--destructive-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        popover: {
          DEFAULT: 'var(--popover)',
          foreground: 'var(--popover-foreground)',
        },
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}