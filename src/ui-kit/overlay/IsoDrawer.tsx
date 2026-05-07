import { CloseButton, Drawer, Portal } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface IsoDrawerProps {
  readonly body?: ReactNode;
  readonly children?: ReactNode;
  readonly closeLabel?: string;
  readonly description?: ReactNode;
  readonly footer?: ReactNode;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly placement?: "start" | "end" | "top" | "bottom";
  readonly title: ReactNode;
}

export function IsoDrawer({
  body,
  children,
  closeLabel = "Close drawer",
  description,
  footer,
  onOpenChange,
  open,
  placement = "end",
  title,
}: IsoDrawerProps): JSX.Element {
  return (
    <Drawer.Root
      lazyMount
      onOpenChange={(details) => onOpenChange(details.open)}
      open={open}
      placement={placement}
    >
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <Drawer.Title>{title}</Drawer.Title>
              {description ? (
                <Drawer.Description>{description}</Drawer.Description>
              ) : null}
            </Drawer.Header>
            <Drawer.Body>{body ?? children}</Drawer.Body>
            {footer ? <Drawer.Footer>{footer}</Drawer.Footer> : null}
            <Drawer.CloseTrigger asChild>
              <CloseButton aria-label={closeLabel} size="sm" />
            </Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  );
}
