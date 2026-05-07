import {
  ChakraProvider,
  createSystem,
  defaultConfig,
  defineConfig,
} from "@chakra-ui/react";
import { defaultTheme } from "@isonia/theme-default";
import type { PropsWithChildren } from "react";
import { IsoToaster } from "./feedback/IsoToaster";

const { colors, radius, typography } = defaultTheme.tokens;

const isoChakraConfig = defineConfig({
  preflight: false,
  theme: {
    tokens: {
      colors: {
        isonia: {
          accent: { value: colors.accent },
          accentSurface: { value: colors.accentSurface },
          background: { value: colors.background },
          border: { value: colors.border },
          danger: { value: colors.danger },
          dangerSurface: { value: colors.dangerSurface },
          foreground: { value: colors.foreground },
          infoSurface: { value: colors.infoSurface },
          muted: { value: colors.muted },
          primary: { value: colors.primary },
          primaryForeground: { value: colors.primaryForeground },
          primaryStrong: { value: colors.primaryStrong },
          success: { value: colors.success },
          successSurface: { value: colors.successSurface },
          surface: { value: colors.surface },
          surfaceSubtle: { value: colors.surfaceSubtle },
          warning: { value: colors.warning },
          warningSurface: { value: colors.warningSurface },
        },
      },
      fonts: {
        body: { value: typography.fontFamily },
        heading: { value: typography.headingFontFamily ?? typography.fontFamily },
        mono: { value: typography.monoFontFamily },
      },
      radii: {
        isoLg: { value: radius.lg },
        isoMd: { value: radius.md },
        isoSm: { value: radius.sm },
        isoXl: { value: radius.xl },
      },
    },
  },
});

const isoChakraSystem = createSystem(defaultConfig, isoChakraConfig);

export function IsoProvider({ children }: PropsWithChildren): JSX.Element {
  return (
    <ChakraProvider value={isoChakraSystem}>
      {children}
      <IsoToaster />
    </ChakraProvider>
  );
}
