/**
 * Design tokens synced from sibling web artifact (konstruksi-riset/src/index.css)
 * Industrial construction theme: amber/yellow primary, dark slate backgrounds
 * Radius: 4px (0.25rem) — very sharp, industrial corners
 */

const colors = {
  light: {
    // Legacy aliases
    text: '#131c2e',
    tint: '#f5b820',

    background: '#f8f9fb',      // slate-50
    foreground: '#131c2e',      // slate-900

    card: '#ffffff',
    cardForeground: '#131c2e',

    primary: '#f5b820',         // construction amber/yellow
    primaryForeground: '#000033',

    secondary: '#e2e8f0',       // slate-200
    secondaryForeground: '#131c2e',

    muted: '#f1f5f9',           // slate-100
    mutedForeground: '#64748b', // slate-500

    accent: '#e2e8f0',
    accentForeground: '#131c2e',

    destructive: '#ef4444',
    destructiveForeground: '#ffffff',

    border: '#e2e8f0',
    input: '#e2e8f0',
  },

  dark: {
    text: '#f0f5ff',
    tint: '#f5b820',

    background: '#131c2e',      // slate-900
    foreground: '#f0f5ff',

    card: '#162338',
    cardForeground: '#f0f5ff',

    primary: '#f5b820',
    primaryForeground: '#000033',

    secondary: '#1e2d45',
    secondaryForeground: '#f0f5ff',

    muted: '#1e2d45',
    mutedForeground: '#94a3b8',

    accent: '#1e2d45',
    accentForeground: '#f0f5ff',

    destructive: '#7f1d1d',
    destructiveForeground: '#f0f5ff',

    border: '#1e2d45',
    input: '#1e2d45',
  },

  // 4px = 0.25rem (very sharp, industrial)
  radius: 4,
};

export default colors;
