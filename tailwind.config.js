/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Festina Lente Bronze/Brown theme
        primary: {
          50: '#fdf8f3',
          100: '#f9ede0',
          200: '#f2d9bd',
          300: '#e8bf8f',
          400: '#dca05e',
          500: '#cd853f', // Main bronze
          600: '#b8703a',
          700: '#995a32',
          800: '#7d4a2e',
          900: '#673d28',
        },
        bronze: {
          50: '#fdf8f3',
          100: '#f9ede0',
          200: '#f2d9bd',
          300: '#e8bf8f',
          400: '#dca05e',
          500: '#cd853f',
          600: '#b8703a',
          700: '#995a32',
          800: '#7d4a2e',
          900: '#673d28',
        },
        // Refined warm gray palette — slightly more neutral, better contrast on dark
        gray: {
          50: '#faf9f7',
          100: '#f0ede8',
          200: '#ddd8cf',
          300: '#c8c1b5',
          400: '#a89d8f',
          500: '#887c6e',
          600: '#6b5f53',
          700: '#524840',
          800: '#3a332c',
          900: '#231f1a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      },
      letterSpacing: {
        'tightest': '-0.04em',
      },
      // Refined shadow scale — softer, multi-layered, warm-tinted
      boxShadow: {
        'xs':    '0 1px 2px 0 rgba(35,31,26,0.06)',
        'sm':    '0 1px 3px 0 rgba(35,31,26,0.10), 0 1px 2px -1px rgba(35,31,26,0.06)',
        'md':    '0 4px 8px -2px rgba(35,31,26,0.10), 0 2px 4px -2px rgba(35,31,26,0.06)',
        'lg':    '0 10px 20px -4px rgba(35,31,26,0.10), 0 4px 8px -4px rgba(35,31,26,0.06)',
        'xl':    '0 20px 40px -8px rgba(35,31,26,0.14), 0 8px 16px -8px rgba(35,31,26,0.08)',
        '2xl':   '0 25px 50px -12px rgba(35,31,26,0.25)',
        // Brand glow for primary actions
        'glow-primary': '0 2px 6px rgba(205,133,63,0.35)',
        'glow-primary-lg': '0 4px 12px rgba(205,133,63,0.40)',
      },
    },
  },
  plugins: [],
};
