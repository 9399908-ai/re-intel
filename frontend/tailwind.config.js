/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: '#001a4d',
        blue: '#0066cc',
        darkblue: '#003399',
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '32px',
        '3xl': '48px',
      },
      borderRadius: {
        tight: '4px',
        normal: '8px',
        rounded: '12px',
        pill: '999px',
      },
      boxShadow: {
        subtle: '0 2px 8px rgba(0,0,0,0.08)',
        medium: '0 4px 12px rgba(0,0,0,0.12)',
        emphasis: '0 10px 40px rgba(0,0,0,0.3)',
      },
    },
  },
  plugins: [],
}
