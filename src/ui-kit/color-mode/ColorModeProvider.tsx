import type { PropsWithChildren } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import {
  ISO_COLOR_MODE_ATTRIBUTE,
  ISO_COLOR_MODE_STORAGE_KEY,
} from "../../theme/color-mode";

export function ColorModeProvider({
  children,
}: PropsWithChildren): JSX.Element {
  return (
    <NextThemesProvider
      attribute={ISO_COLOR_MODE_ATTRIBUTE}
      defaultTheme="light"
      disableTransitionOnChange
      enableSystem
      storageKey={ISO_COLOR_MODE_STORAGE_KEY}
      themes={["light", "dark"]}
    >
      {children}
    </NextThemesProvider>
  );
}
