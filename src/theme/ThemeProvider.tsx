import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { appCoreTheme } from "./isonia-theme";

export function ThemeProvider({ children }: PropsWithChildren): JSX.Element {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.isoniaTheme = appCoreTheme.id;
    for (const [name, value] of Object.entries(appCoreTheme.cssVariables)) {
      root.style.setProperty(name, value);
    }
  }, []);

  return <>{children}</>;
}
