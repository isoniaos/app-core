import { useEffect, useMemo, useRef } from "react";
import { useAppKitTheme } from "@reown/appkit/react";
import type { IsoResolvedColorMode } from "../theme/color-mode";
import { useIsoColorMode } from "../ui-kit";
import { createReownThemeVariables } from "./reown-theme";

export function ReownThemeBridge(): null {
  const { resolvedColorMode } = useIsoColorMode();
  const { setThemeMode, setThemeVariables } = useAppKitTheme();
  const lastAppliedModeRef = useRef<IsoResolvedColorMode | undefined>(
    undefined,
  );
  const themeVariables = useMemo(
    () => createReownThemeVariables(resolvedColorMode),
    [resolvedColorMode],
  );

  useEffect(() => {
    if (lastAppliedModeRef.current === resolvedColorMode) {
      return;
    }

    setThemeMode(resolvedColorMode);
    setThemeVariables(themeVariables);
    lastAppliedModeRef.current = resolvedColorMode;
  }, [resolvedColorMode, themeVariables]);

  return null;
}
