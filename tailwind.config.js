/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F7F3F0',
        textMain: '#3C3633',
        textLight: '#8E847E',
        accent: '#B0927A',
        border: '#E8E2DE',
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', 'system-ui', 'sans-serif'],
        serif: ['"Noto Serif TC"', 'serif'],
      },
      keyframes: {
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)' },
          '15%': { transform: 'scale(1.1)' },
          '30%': { transform: 'scale(1.2)' },
        },
      },
      animation: {
        heartbeat: 'heartbeat 2s infinite ease-in-out',
      },
    },
  },
  plugins: [],
}

