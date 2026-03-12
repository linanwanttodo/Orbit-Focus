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
                dark: {
                    900: '#0B0C15',
                    800: '#151725',
                    700: '#1E2136',
                    600: '#2A2E45',
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
