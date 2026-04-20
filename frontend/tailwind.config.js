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
          DEFAULT: "#2563eb",
          hover: "#1d4ed8",
          light: "#3b82f6",
        },
        surface: {
          DEFAULT: "#1e293b",
          hover: "#334155",
          light: "#475569",
        },
        background: "#0f172a",
        border: {
          DEFAULT: "#334155",
          light: "#475569",
        },
        text: {
          primary: "#f8fafc",
          secondary: "#94a3b8",
          muted: "#64748b",
        },
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "16px",
        xl: "24px",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgba(0, 0, 0, 0.3)",
        md: "0 4px 6px -1px rgba(0, 0, 0, 0.4)",
        lg: "0 10px 15px -3px rgba(0, 0, 0, 0.5)",
        glow: "0 0 20px rgba(37, 99, 235, 0.3)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
    },
  },
  plugins: [],
}
