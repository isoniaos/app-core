import { CloseButton, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import type { ReactElement, ReactNode } from "react";
import { useState } from "react";

export interface IsoToggleTipProps {
  readonly children: ReactElement;
  readonly closeLabel?: string;
  readonly content: ReactNode;
  readonly onOpenChange?: (open: boolean) => void;
  readonly open?: boolean;
  readonly title?: ReactNode;
}

export function IsoToggleTip({
  children,
  closeLabel = "Close help",
  content,
  onOpenChange,
  open,
  title,
}: IsoToggleTipProps): JSX.Element {
  const controlled = open !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const currentOpen = controlled ? open : internalOpen;

  function setOpen(nextOpen: boolean): void {
    if (!controlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  }

  return (
    <Popover.Root
      lazyMount
      onOpenChange={(details) => setOpen(details.open)}
      open={currentOpen}
    >
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content>
            <Popover.Body>
              <Stack gap="2" paddingInlineEnd="6">
                {title ? (
                  <Text color="isonia.foreground" fontWeight="700">
                    {title}
                  </Text>
                ) : null}
                <Text color="isonia.muted" fontSize="sm">
                  {content}
                </Text>
              </Stack>
            </Popover.Body>
            <Popover.CloseTrigger asChild>
              <CloseButton
                aria-label={closeLabel}
                position="absolute"
                right="2"
                size="sm"
                top="2"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                }}
              />
            </Popover.CloseTrigger>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
}
