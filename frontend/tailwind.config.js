/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary)',
          hover: 'var(--primary-hover)',
          light: 'var(--primary-light)',
          50: 'var(--primary-50)',
          100: 'var(--primary-100)',
          200: 'var(--primary-200)',
          300: 'var(--primary-300)',
          400: 'var(--primary-400)',
          500: 'var(--primary-500)',
          600: 'var(--primary-600)',
          700: 'var(--primary-700)',
          800: 'var(--primary-800)',
          900: 'var(--primary-900)',
        },
        'primary-dark': 'var(--primary-hover)',
        'primary-light': 'var(--primary-light)',

        secondary: {
          DEFAULT: 'var(--secondary)',
          light: 'var(--surface)',
          dark: 'var(--border-strong)',
        },
        'secondary-light': 'var(--surface)',
        'secondary-dark': 'var(--border-strong)',

        accent: {
          DEFAULT: 'var(--accent)',
          light: 'var(--primary-light)',
          dark: 'var(--primary-hover)',
        },
        'accent-light': 'var(--primary-light)',
        'accent-dark': 'var(--primary-hover)',

        surface: 'var(--surface)',
        background: 'var(--background)',
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          text: 'var(--sidebar-text)',
          muted: 'var(--sidebar-muted)',
        },
        navbar: 'var(--navbar)',
        border: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },

        // Legacy & Component Compatibility Aliases
        'neutral-bg': 'var(--background)',
        'card-bg': 'var(--surface)',
        'sidebar-bg': 'var(--sidebar)',

        // Text Colors
        'text-main': 'var(--text-primary)',
        'text-sub': 'var(--text-secondary)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'muted-text': 'var(--text-muted)',

        // Border Colors
        'border-light': 'var(--border)',
        'border-lighter': 'var(--border)',
        'border-strong': 'var(--border-strong)',

        // Status Colors
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        error: 'var(--danger)',
        info: 'var(--info)',

        // Student portal colors mapped to dynamic tokens
        portal: {
          sky: 'var(--info)',
          'sky-dark': 'var(--primary)',
          'sky-light': 'var(--primary-light)',
          indigo: 'var(--primary)',
          'indigo-dark': 'var(--primary-hover)',
          teal: 'var(--accent)',
          'teal-dark': 'var(--primary-hover)',
          violet: 'var(--secondary)',
          surface: 'var(--background)',
          card: 'var(--surface)',
        },

        // Navy palette mapped to dynamic theme scale
        navy: {
          50: 'var(--primary-50)',
          100: 'var(--primary-100)',
          200: 'var(--primary-200)',
          300: 'var(--primary-300)',
          400: 'var(--primary-400)',
          500: 'var(--primary-500)',
          600: 'var(--primary-600)',
          700: 'var(--primary-700)',
          800: 'var(--primary-800)',
          900: 'var(--primary-900)',
        },
      },
    },
  },
  plugins: [],
}
