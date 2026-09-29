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
      // Values mirror frontend/src/styles/theme.css so Tailwind utilities and
      // CSS variables never drift. Keep both lists in sync.
      colors: {
        header: {
          DEFAULT: 'var(--color-header)',
          hover: 'var(--color-header-hover)',
          text: 'var(--color-header-text)',
          'text-strong': 'var(--color-header-text-strong)',
          'text-muted': 'var(--color-header-text-muted)',
          'icon-hover': 'var(--color-header-icon-hover)',
          focus: 'var(--color-header-focus)',
          badge: 'var(--color-header-badge)',
        },
        sidebar: {
          DEFAULT: 'var(--color-sidebar)',
          hover: 'var(--color-sidebar-hover)',
          active: 'var(--color-sidebar-active)',
          text: 'var(--color-sidebar-text)',
          'text-active': 'var(--color-sidebar-text-active)',
          label: 'var(--color-sidebar-label)',
          divider: 'var(--color-sidebar-divider)',
        },
        page: {
          background: 'var(--color-background)',
          card: 'var(--color-surface)',
          border: 'var(--color-border)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          'muted-on-page': 'var(--color-text-secondary-on-page)',
        },
        footer: {
          background: 'var(--color-footer-background)',
          border: 'var(--color-footer-border)',
          text: 'var(--color-footer-text)',
          link: 'var(--color-footer-link)',
        },
        login: {
          background: 'var(--color-background)',
          card: 'var(--color-surface)',
          primary: 'var(--color-primary)',
          'primary-hover': 'var(--color-primary-hover)',
        },
        primary: 'var(--color-primary)',
        'primary-dark': 'var(--color-primary-hover)',
        navy: 'var(--color-sidebar)',
        sky: 'var(--color-header)',
        'sky-dark': 'var(--color-header-hover)',
        gold: 'var(--color-accent)',
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        text: 'var(--color-text-primary)',
        muted: 'var(--color-text-muted)',
        border: 'var(--color-border)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)',
        neutral: 'var(--color-neutral)',
        card: {
          DEFAULT: 'var(--color-surface)',
          foreground: 'var(--color-text-primary)',
        },
        input: {
          DEFAULT: 'var(--color-surface)',
          border: 'var(--color-border)',
        },
        chart: {
          1: 'var(--color-chart-1)',
          2: 'var(--color-chart-2)',
          3: 'var(--color-chart-3)',
          4: 'var(--color-chart-4)',
          5: 'var(--color-chart-5)',
          6: 'var(--color-chart-6)',
          grid: 'var(--color-chart-grid)',
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