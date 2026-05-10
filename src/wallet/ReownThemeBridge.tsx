import { useEffect } from "react";
import { useAppKitTheme } from "@reown/appkit/react";
import { useIsoColorMode } from "../ui-kit";
import { createReownThemeVariables } from "./reown-theme";

export function ReownThemeBridge(): null {
  const { resolvedColorMode } = useIsoColorMode();
  const { setThemeMode, setThemeVariables } = useAppKitTheme();

  useEffect(() => {
    setThemeMode(resolvedColorMode);
    setThemeVariables(createReownThemeVariables(resolvedColorMode));
  }, [resolvedColorMode, setThemeMode, setThemeVariables]);

  return null;
}
