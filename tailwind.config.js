/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#dce6ff',
          200: '#b9ccff',
          300: '#85a6ff',
          400: '#4d74ff',
          500: '#2952ff',
          600: '#1130f5',
          700: '#0e22de',
          800: '#1120b4',
          900: '#14238e',
          950: '#0c1557',
        },
      },
    },
  },
  plugins: [],
}
