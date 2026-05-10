import { useCallback } from "react";
import { useTheme } from "next-themes";
import {
  type IsoColorMode,
  type IsoResolvedColorMode,
  isIsoColorMode,
  isIsoResolvedColorMode,
  resolveIsoColorMode,
} from "../../theme/color-mode";

export interface UseIsoColorModeResult {
  readonly colorMode: IsoColorMode;
  readonly resolvedColorMode: IsoResolvedColorMode;
  readonly cycleColorMode: () => void;
  readonly setColorMode: (mode: IsoColorMode) => void;
}

export function useIsoColorMode(): UseIsoColorModeResult {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const colorMode = isIsoColorMode(theme) ? theme : "light";
  const resolvedColorMode = isIsoResolvedColorMode(resolvedTheme)
    ? resolvedTheme
    : resolveIsoColorMode(colorMode);

  const setColorMode = useCallback(
    (mode: IsoColorMode) => {
      setTheme(mode);
    },
    [setTheme],
  );

  const cycleColorMode = useCallback(() => {
    const nextMode = getNextColorMode(colorMode);
    setTheme(nextMode);
  }, [colorMode, setTheme]);

  return {
    colorMode,
    resolvedColorMode,
    cycleColorMode,
    setColorMode,
  };
}

function getNextColorMode(mode: IsoColorMode): IsoColorMode {
  if (mode === "light") {
    return "dark";
  }

  if (mode === "dark") {
    return "system";
  }

  return "light";
}
