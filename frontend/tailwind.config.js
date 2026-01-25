/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#13a4ec',
        'primary-dark': '#0e8bc7',
        'background-light': '#f6f7f8',
        'background-dark': '#101c22',
        'surface-light': '#ffffff',
        'surface-dark': '#1c2a33',
        'text-main-light': '#0d171b',
        'text-main-dark': '#e0e6e9',
        'text-sec-light': '#4c809a',
        'text-sec-dark': '#8daab9',
      },
      fontFamily: {
        display: ['Noto Sans SC', 'Manrope', 'PingFang SC', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        full: '9999px',
      },
      boxShadow: {
        soft: '0 4px 20px -2px rgba(0, 0, 0, 0.05)',
      },
    },
  },
  plugins: [],
};
