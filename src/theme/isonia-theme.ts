import { defaultTheme } from "@isonia/theme-default";

const palette = {
  amber: "#D97706",
  amberBright: "#F59E0B",
  blue: "#2563EB",
  blueBright: "#3B82F6",
  blueStrong: "#2F6FED",
  emerald: "#10B981",
  emeraldStrong: "#059669",
  ivory: "#F8F7F2",
  ivoryBright: "#FAFAF7",
  ivoryMuted: "#F5F1E8",
  navy: "#0B1220",
  navySoft: "#101827",
  navySurface: "#111D2E",
  red: "#DC2626",
  slate: "#475569",
  slateDark: "#334155",
  slateLight: "#64748B",
} as const;

const colors = {
  ...defaultTheme.tokens.colors,
  accent: palette.blueBright,
  accentSurface: `color-mix(in srgb, ${palette.blueBright} 12%, ${palette.ivoryBright})`,
  background: palette.ivory,
  border: `color-mix(in srgb, ${palette.slateLight} 36%, ${palette.ivory})`,
  danger: palette.red,
  dangerSurface: `color-mix(in srgb, ${palette.red} 11%, ${palette.ivoryBright})`,
  foreground: palette.navy,
  infoSurface: `color-mix(in srgb, ${palette.blue} 10%, ${palette.ivoryBright})`,
  muted: palette.slate,
  primary: palette.blue,
  primaryForeground: palette.ivoryBright,
  primaryStrong: palette.blueStrong,
  success: palette.emerald,
  successSurface: `color-mix(in srgb, ${palette.emerald} 12%, ${palette.ivoryBright})`,
  surface: palette.ivoryBright,
  surfaceSubtle: palette.ivoryMuted,
  warning: palette.amber,
  warningSurface: `color-mix(in srgb, ${palette.amberBright} 15%, ${palette.ivoryBright})`,
};

const typography = {
  ...defaultTheme.tokens.typography,
  condensedFontFamily:
    '"IBM Plex Sans Condensed", "Arial Narrow", "Segoe UI", sans-serif',
  fontFamily:
    '"IBM Plex Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headingFontFamily:
    '"IBM Plex Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  monoFontFamily:
    '"IBM Plex Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
};

export const appCoreTheme = {
  ...defaultTheme,
  cssVariables: {
    ...defaultTheme.cssVariables,
    "--iso-color-accent": colors.accent,
    "--iso-color-accent-surface": colors.accentSurface,
    "--iso-color-background": colors.background,
    "--iso-color-border": colors.border,
    "--iso-color-danger": colors.danger,
    "--iso-color-danger-surface": colors.dangerSurface,
    "--iso-color-foreground": colors.foreground,
    "--iso-color-info-surface": colors.infoSurface,
    "--iso-color-muted": colors.muted,
    "--iso-color-primary": colors.primary,
    "--iso-color-primary-foreground": colors.primaryForeground,
    "--iso-color-primary-strong": colors.primaryStrong,
    "--iso-color-success": colors.success,
    "--iso-color-success-surface": colors.successSurface,
    "--iso-color-surface": colors.surface,
    "--iso-color-surface-subtle": colors.surfaceSubtle,
    "--iso-color-warning": colors.warning,
    "--iso-color-warning-surface": colors.warningSurface,
    "--iso-font-condensed": typography.condensedFontFamily,
    "--iso-font-mono": typography.monoFontFamily,
    "--iso-font-sans": typography.fontFamily,
  },
  tokens: {
    ...defaultTheme.tokens,
    colors,
    typography,
  },
};
