/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './src/**/*.json',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Arial', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
      },
      colors: {
        dashboard: {
          header: '#B1BAC4',
          sidebar: '#8F9BA7',
          'sidebar-hover': '#C5CED6',
          'sidebar-active': '#D9E0E6',
        },
        page: {
          background: '#F5F7F9',
          card: '#FFFFFF',
          border: '#D7DEE5',
        },
        text: {
          primary: '#17212B',
          secondary: '#334155',
          muted: '#718096',
        },
        footer: {
          background: '#687784',
          text: '#FFFFFF',
          muted: '#E7ECF0',
        },
        login: {
          background: '#EEF2F5',
          card: '#FFFFFF',
          primary: '#536575',
          'primary-hover': '#435463',
        },
        primary: '#B1BAC4',
        'primary-dark': '#6B7786',
        navy: '#17212B',
        background: '#F5F7F9',
        surface: '#FFFFFF',
        text: '#17212B',
        muted: '#718096',
        border: '#D7DEE5',
        success: '#16A34A',
        warning: '#F59E0B',
        danger: '#DC2626',
        info: '#536575',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#17212B',
        },
        input: {
          DEFAULT: '#FFFFFF',
          border: '#C8D1D9',
        },
        sidebar: {
          DEFAULT: '#8F9BA7',
          foreground: '#17212B',
          muted: '#334155',
          border: '#D7DEE5',
          hover: '#C5CED6',
          active: '#D9E0E6',
        },
      },
      borderRadius: {
        lg: 'calc(var(--radius) + 4px)',
        md: 'calc(var(--radius) + 2px)',
        sm: 'calc(var(--radius))',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        skeletonPulse: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        accordionDown: {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        accordionUp: {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.2s ease-out',
        skeletonPulse: 'skeletonPulse 1.5s ease-in-out infinite',
        accordionDown: 'accordionDown 0.2s ease-out',
        accordionUp: 'accordionUp 0.2s ease-out',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    require('@tailwindcss/aspect-ratio'),
  ],
};