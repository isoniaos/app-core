import { Text } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface IsoHelpTextProps {
  readonly children: ReactNode;
}

export function IsoHelpText({ children }: IsoHelpTextProps): JSX.Element {
  return (
    <Text color="isonia.muted" fontSize="sm" lineHeight="1.5">
      {children}
    </Text>
  );
}
