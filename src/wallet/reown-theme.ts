import type { CreateAppKit } from "@reown/appkit/react";
import type { IsoResolvedColorMode } from "../theme/color-mode";
import { appCoreTheme } from "../theme/isonia-theme";

export type ReownThemeMode = Extract<
  NonNullable<CreateAppKit["themeMode"]>,
  "light" | "dark"
>;

export type ReownThemeVariables = NonNullable<
  CreateAppKit["themeVariables"]
>;

export function createReownThemeVariables(
  mode: IsoResolvedColorMode,
): ReownThemeVariables {
  const colors = appCoreTheme.colorModes[mode].colors;

  return {
    "--w3m-accent": colors.primary,
    "--w3m-border-radius-master": appCoreTheme.tokens.radius.md,
    "--w3m-color-mix": colors.surface,
    "--w3m-color-mix-strength": mode === "dark" ? 22 : 8,
    "--w3m-font-family": appCoreTheme.tokens.typography.fontFamily,
    "--w3m-z-index": 1200,
  };
}
