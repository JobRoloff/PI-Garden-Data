"use client";

import { useTheme } from "../ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="theme-toggle"
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
