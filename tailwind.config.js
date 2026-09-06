/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#007AFF",
        "background-light": "#F2F2F7",
        "background-dark": "#000000",
        "glass-light": "rgba(255, 255, 255, 0.7)",
        "glass-dark": "rgba(28, 28, 30, 0.8)",
      },
      fontFamily: {
        display: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
      borderRadius: { DEFAULT: "12px", ios: "20px" },
    },
  },
  plugins: [],
};
