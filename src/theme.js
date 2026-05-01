/**
 * AccuChart design tokens — single source for colors & typography.
 * Import `T` in components for shorthand inline styles (`T.pink`, etc.).
 */

export const colors = {
  bg: "#F7F8FA",
  surface: "#FFFFFF",
  border: "#E4E8EF",
  navy: "#0B1F3A",
  teal: "#0891B2",
  pink: "#E91E8C",
  green: "#059669",
  amber: "#D97706",
  red: "#DC2626",
  slate: "#475569",
  muted: "#94A3B8",
  light: "#EEF2F7",
  text: "#0F172A",
  sub: "#64748B",
};

export const typography = {
  sans: "'Lato','Segoe UI',sans-serif",
  brand: "'Playfair Display',serif",
};

/** Alias used throughout inline styles */
export const T = colors;
