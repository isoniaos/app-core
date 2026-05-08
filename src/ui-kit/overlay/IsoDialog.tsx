import { CloseButton, Dialog, Portal } from "@chakra-ui/react";
import type { ReactNode } from "react";

export interface IsoDialogProps {
  readonly body?: ReactNode;
  readonly children?: ReactNode;
  readonly closeLabel?: string;
  readonly description?: ReactNode;
  readonly footer?: ReactNode;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly title: ReactNode;
}

export function IsoDialog({
  body,
  children,
  closeLabel = "Close dialog",
  description,
  footer,
  onOpenChange,
  open,
  title,
}: IsoDialogProps): JSX.Element {
  return (
    <Dialog.Root
      lazyMount
      onOpenChange={(details) => onOpenChange(details.open)}
      open={open}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header className="iso-dialog-header">
              <Dialog.Title className="iso-dialog-title">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="iso-dialog-description">
                  {description}
                </Dialog.Description>
              ) : null}
            </Dialog.Header>
            <Dialog.Body>{body ?? children}</Dialog.Body>
            {footer ? <Dialog.Footer>{footer}</Dialog.Footer> : null}
            <Dialog.CloseTrigger asChild>
              <CloseButton aria-label={closeLabel} size="sm" />
            </Dialog.CloseTrigger>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
