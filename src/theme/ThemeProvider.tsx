import { defaultTheme } from "@isonia/theme-default";
import type { PropsWithChildren } from "react";
import { useEffect } from "react";

export function ThemeProvider({ children }: PropsWithChildren): JSX.Element {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.isoniaTheme = defaultTheme.id;
    for (const [name, value] of Object.entries(defaultTheme.cssVariables)) {
      root.style.setProperty(name, value);
    }
  }, []);

  return <>{children}</>;
}
