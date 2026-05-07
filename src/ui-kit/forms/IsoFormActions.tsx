import { HStack } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface IsoFormActionsProps {
  readonly align?: "start" | "end" | "space-between";
  readonly children: ReactNode;
}

export function IsoFormActions({
  align = "end",
  children,
}: IsoFormActionsProps): JSX.Element {
  const justify = align === "space-between" ? "space-between" : `flex-${align}`;

  return (
    <HStack gap="3" justify={justify} wrap="wrap">
      {children}
    </HStack>
  );
}
