/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./server/**/*.{ts,tsx}",
  ],
  theme: { extend: {} },
  plugins: [import("@tailwindcss/forms")],
};
