import { defaultTheme } from "@isonia/theme-default";

const palette = {
  amber: "#D97706",
  amberBright: "#F59E0B",
  amberSoft: "#FBBF24",
  blue: "#2563EB",
  blueBright: "#3B82F6",
  blueCalm: "#7AA7F7",
  blueMist: "#9ABCFB",
  blueStrong: "#2F6FED",
  deepNavy: "#071120",
  emerald: "#10B981",
  emeraldSoft: "#34D399",
  emeraldStrong: "#059669",
  ivory: "#F8F7F2",
  ivoryBright: "#FAFAF7",
  ivoryMuted: "#F5F1E8",
  navy: "#0B1220",
  navySoft: "#101827",
  navySurface: "#111D2E",
  navySurfaceRaised: "#142338",
  navySurfaceSubtle: "#182A42",
  purple: "#6D5DFB",
  purpleSoft: "#A78BFA",
  red: "#DC2626",
  redSoft: "#F87171",
  slate: "#475569",
  slateDark: "#334155",
  slateLight: "#64748B",
  slateLighter: "#AAB7C7",
  warmWhite: "#F7F3EA",
} as const;

const lightColors = {
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
  policy: palette.purple,
  policySurface: `color-mix(in srgb, ${palette.purple} 11%, ${palette.ivoryBright})`,
  shell: palette.ivory,
  sidebar: `color-mix(in srgb, ${palette.ivoryBright} 76%, ${palette.ivory})`,
  success: palette.emerald,
  successSurface: `color-mix(in srgb, ${palette.emerald} 12%, ${palette.ivoryBright})`,
  surface: palette.ivoryBright,
  surfaceRaised: "#FFFFFF",
  surfaceSubtle: palette.ivoryMuted,
  topbar: `color-mix(in srgb, ${palette.ivoryBright} 88%, transparent)`,
  topbarBorder: `color-mix(in srgb, ${palette.slateLight} 24%, transparent)`,
  warning: palette.amber,
  warningSurface: `color-mix(in srgb, ${palette.amberBright} 15%, ${palette.ivoryBright})`,
};

const darkColors = {
  ...defaultTheme.tokens.colors,
  accent: palette.blueCalm,
  accentSurface: `color-mix(in srgb, ${palette.blueCalm} 16%, ${palette.navySurface})`,
  background: palette.deepNavy,
  border: `color-mix(in srgb, ${palette.slateLight} 34%, ${palette.navySurface})`,
  danger: palette.redSoft,
  dangerSurface: `color-mix(in srgb, ${palette.redSoft} 14%, ${palette.navySurface})`,
  foreground: palette.warmWhite,
  infoSurface: `color-mix(in srgb, ${palette.blueCalm} 14%, ${palette.navySurface})`,
  muted: palette.slateLighter,
  primary: palette.blueCalm,
  primaryForeground: palette.deepNavy,
  primaryStrong: palette.blueMist,
  policy: palette.purpleSoft,
  policySurface: `color-mix(in srgb, ${palette.purpleSoft} 14%, ${palette.navySurface})`,
  shell: palette.deepNavy,
  sidebar: `color-mix(in srgb, ${palette.navySurface} 86%, ${palette.deepNavy})`,
  success: palette.emeraldSoft,
  successSurface: `color-mix(in srgb, ${palette.emeraldSoft} 13%, ${palette.navySurface})`,
  surface: palette.navySurface,
  surfaceRaised: palette.navySurfaceRaised,
  surfaceSubtle: palette.navySurfaceSubtle,
  topbar: `color-mix(in srgb, ${palette.navySurface} 88%, transparent)`,
  topbarBorder: `color-mix(in srgb, ${palette.slateLight} 30%, transparent)`,
  warning: palette.amberSoft,
  warningSurface: `color-mix(in srgb, ${palette.amberSoft} 14%, ${palette.navySurface})`,
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

const lightCssVariables = createCssVariables(lightColors, {
  cardShadow:
    "0 1px 2px color-mix(in srgb, #0B1220 7%, transparent), 0 12px 30px color-mix(in srgb, #0B1220 4%, transparent)",
  shellShadow: "0 18px 48px color-mix(in srgb, #0B1220 8%, transparent)",
});

const darkCssVariables = createCssVariables(darkColors, {
  cardShadow:
    "0 1px 2px color-mix(in srgb, #000000 28%, transparent), 0 16px 36px color-mix(in srgb, #000000 22%, transparent)",
  shellShadow: "0 18px 48px color-mix(in srgb, #000000 30%, transparent)",
});

export const appCoreTheme = {
  ...defaultTheme,
  colorModes: {
    dark: {
      colors: darkColors,
      cssVariables: darkCssVariables,
    },
    light: {
      colors: lightColors,
      cssVariables: lightCssVariables,
    },
  },
  cssVariables: {
    ...defaultTheme.cssVariables,
    ...lightCssVariables,
    "--iso-font-condensed": typography.condensedFontFamily,
    "--iso-font-mono": typography.monoFontFamily,
    "--iso-font-sans": typography.fontFamily,
  },
  tokens: {
    ...defaultTheme.tokens,
    colors: lightColors,
    typography,
  },
};

interface ThemeColors {
  readonly accent: string;
  readonly accentSurface: string;
  readonly background: string;
  readonly border: string;
  readonly danger: string;
  readonly dangerSurface: string;
  readonly foreground: string;
  readonly infoSurface: string;
  readonly muted: string;
  readonly policy: string;
  readonly policySurface: string;
  readonly primary: string;
  readonly primaryForeground: string;
  readonly primaryStrong: string;
  readonly shell: string;
  readonly sidebar: string;
  readonly success: string;
  readonly successSurface: string;
  readonly surface: string;
  readonly surfaceRaised: string;
  readonly surfaceSubtle: string;
  readonly topbar: string;
  readonly topbarBorder: string;
  readonly warning: string;
  readonly warningSurface: string;
}

function createCssVariables(
  colors: ThemeColors,
  shadows: {
    readonly cardShadow: string;
    readonly shellShadow: string;
  },
): Record<string, string> {
  return {
    "--iso-color-accent": colors.accent,
    "--iso-color-accent-surface": colors.accentSurface,
    "--iso-color-background": colors.background,
    "--iso-color-border": colors.border,
    "--iso-color-danger": colors.danger,
    "--iso-color-danger-surface": colors.dangerSurface,
    "--iso-color-foreground": colors.foreground,
    "--iso-color-info-surface": colors.infoSurface,
    "--iso-color-muted": colors.muted,
    "--iso-color-policy": colors.policy,
    "--iso-color-policy-surface": colors.policySurface,
    "--iso-color-primary": colors.primary,
    "--iso-color-primary-foreground": colors.primaryForeground,
    "--iso-color-primary-strong": colors.primaryStrong,
    "--iso-color-shell": colors.shell,
    "--iso-color-sidebar": colors.sidebar,
    "--iso-color-success": colors.success,
    "--iso-color-success-surface": colors.successSurface,
    "--iso-color-surface": colors.surface,
    "--iso-color-surface-raised": colors.surfaceRaised,
    "--iso-color-surface-subtle": colors.surfaceSubtle,
    "--iso-color-topbar": colors.topbar,
    "--iso-color-topbar-border": colors.topbarBorder,
    "--iso-color-warning": colors.warning,
    "--iso-color-warning-surface": colors.warningSurface,
    "--iso-shadow-card": shadows.cardShadow,
    "--iso-shadow-shell": shadows.shellShadow,
  };
}
