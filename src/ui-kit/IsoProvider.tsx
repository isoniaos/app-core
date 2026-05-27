import {
  ChakraProvider,
  createSystem,
  defaultConfig,
  defineConfig,
} from "@chakra-ui/react";
import { createIsoniaChakraThemeConfig } from "@isonia/theme-default/chakra";
import type { PropsWithChildren } from "react";
import { IsoToaster } from "./feedback/IsoToaster";

const isoChakraConfig = defineConfig(
  createIsoniaChakraThemeConfig({ preflight: false }),
);

const isoChakraSystem = createSystem(defaultConfig, isoChakraConfig);

export function IsoProvider({ children }: PropsWithChildren): JSX.Element {
  return (
    <ChakraProvider value={isoChakraSystem}>
      {children}
      <IsoToaster />
    </ChakraProvider>
  );
}
