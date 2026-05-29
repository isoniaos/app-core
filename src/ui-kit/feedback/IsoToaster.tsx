import { Portal, Toast, Toaster, createToaster } from "@chakra-ui/react";

export const isoToaster = createToaster({
  gap: 10,
  max: 4,
  overlap: false,
  placement: "bottom-end",
});

export function IsoToaster(): JSX.Element {
  return (
    <Portal>
      <Toaster toaster={isoToaster}>
        {(toast) => (
          <Toast.Root
            borderColor="var(--iso-color-border)"
            borderRadius="var(--iso-radius-md)"
            borderWidth="1px"
            background="var(--iso-color-surface)"
            boxShadow="0 10px 28px rgba(11, 18, 32, 0.12)"
            color="var(--iso-color-foreground)"
            minW={{ base: "min(320px, calc(100vw - 32px))", md: "340px" }}
            px="0.85rem"
            py="0.75rem"
          >
            <Toast.Indicator />
            <Toast.Title fontSize="0.9rem" fontWeight="var(--iso-font-weight-bold)">
              {toast.title}
            </Toast.Title>
            {toast.description ? (
              <Toast.Description color="var(--iso-color-muted)" fontSize="0.82rem">
                {toast.description}
              </Toast.Description>
            ) : null}
            <Toast.CloseTrigger />
          </Toast.Root>
        )}
      </Toaster>
    </Portal>
  );
}
