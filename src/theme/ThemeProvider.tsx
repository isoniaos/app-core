import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { defaultTheme } from "./default-theme";

export function ThemeProvider({ children }: PropsWithChildren): JSX.Element {
  useEffect(() => {
    const root = document.documentElement;
    for (const [name, value] of Object.entries(defaultTheme.tokens)) {
      root.style.setProperty(`--${name}`, value);
    }
  }, []);

  return <>{children}</>;
}

