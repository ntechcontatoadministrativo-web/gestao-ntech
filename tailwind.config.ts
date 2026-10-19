import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#070908",
          900: "#0B0F0E",
          850: "#101514",
          800: "#151B19",
          700: "#1E2623",
          600: "#2A3430",
          500: "#3B4742",
          400: "#6B7873",
          300: "#9AA6A1",
          200: "#C9D1CD",
          100: "#E8EDEA",
        },
        neon: {
          DEFAULT: "#5CFF4F",
          400: "#7DFF73",
          500: "#5CFF4F",
          600: "#3FE033",
          700: "#1F8A18",
          900: "#0E2B0C",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
