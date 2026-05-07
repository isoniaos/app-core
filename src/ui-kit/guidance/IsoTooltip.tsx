import { Portal, Tooltip } from "@chakra-ui/react";
import type { ReactElement, ReactNode } from "react";

export interface IsoTooltipProps {
  readonly children: ReactElement;
  readonly content: ReactNode;
  readonly disabled?: boolean;
  readonly openDelay?: number;
}

export function IsoTooltip({
  children,
  content,
  disabled = false,
  openDelay = 300,
}: IsoTooltipProps): JSX.Element {
  if (disabled) {
    return children;
  }

  return (
    <Tooltip.Root openDelay={openDelay}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Portal>
        <Tooltip.Positioner>
          <Tooltip.Content>{content}</Tooltip.Content>
        </Tooltip.Positioner>
      </Portal>
    </Tooltip.Root>
  );
}
