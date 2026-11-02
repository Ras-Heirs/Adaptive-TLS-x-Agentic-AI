import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sky: { DEFAULT: "#2E8FE6", deep: "#1E6FC2" },
        sun: { DEFAULT: "#FFB020", deep: "#F08A1E" },
        signal: {
          green: "#2FAE66",
          greenDark: "#1F8A4E",
          red: "#EF4B42",
          redDark: "#C73A33",
        },
        ink: { DEFAULT: "#17314D", soft: "#5C7592" },
        line: "#DCE7F2",
        canvas: "#F2F6FB",
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans Variable", "system-ui", "sans-serif"],
        display: ["Fraunces Variable", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 6px 24px -8px rgba(23,49,77,0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
