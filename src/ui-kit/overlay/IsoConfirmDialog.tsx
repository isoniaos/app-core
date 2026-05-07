import { Button, HStack } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { IsoDialog } from "./IsoDialog";

export interface IsoConfirmDialogProps {
  readonly body?: ReactNode;
  readonly cancelLabel?: string;
  readonly confirmLabel?: string;
  readonly confirmTone?: "danger" | "primary";
  readonly description?: ReactNode;
  readonly onCancel?: () => void;
  readonly onConfirm: () => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly open: boolean;
  readonly title: ReactNode;
}

export function IsoConfirmDialog({
  body,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  confirmTone = "primary",
  description,
  onCancel,
  onConfirm,
  onOpenChange,
  open,
  title,
}: IsoConfirmDialogProps): JSX.Element {
  const handleCancel = (): void => {
    onCancel?.();
    onOpenChange(false);
  };

  return (
    <IsoDialog
      body={body}
      description={description}
      footer={
        <HStack gap="3" justify="flex-end" width="full">
          <Button onClick={handleCancel} variant="outline">
            {cancelLabel}
          </Button>
          <Button
            colorPalette={confirmTone === "danger" ? "red" : "blue"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </HStack>
      }
      onOpenChange={onOpenChange}
      open={open}
      title={title}
    />
  );
}
