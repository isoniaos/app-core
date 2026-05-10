import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { useIsoColorMode } from "../ui-kit/color-mode/useIsoColorMode";
import { ISO_COLOR_MODE_DATA_ATTRIBUTE } from "./color-mode";
import { appCoreTheme } from "./isonia-theme";

export function ThemeProvider({ children }: PropsWithChildren): JSX.Element {
  const { resolvedColorMode } = useIsoColorMode();

  useEffect(() => {
    const root = document.documentElement;
    const colorModeTheme = appCoreTheme.colorModes[resolvedColorMode];

    root.dataset.isoniaTheme = appCoreTheme.id;
    root.dataset[ISO_COLOR_MODE_DATA_ATTRIBUTE] = resolvedColorMode;
    root.style.colorScheme = resolvedColorMode;

    for (const [name, value] of Object.entries(colorModeTheme.cssVariables)) {
      root.style.setProperty(name, value);
    }
  }, [resolvedColorMode]);

  return <>{children}</>;
}
