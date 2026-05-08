import { Stack, Text } from "@chakra-ui/react";
import {
  cloneElement,
  useId,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";

export interface IsoToggleTipProps {
  readonly children: ReactElement;
  readonly closeLabel?: string;
  readonly content: ReactNode;
  readonly onOpenChange?: (open: boolean) => void;
  readonly open?: boolean;
  readonly title?: ReactNode;
}

type ToggleTipTriggerProps = {
  readonly "aria-controls"?: string;
  readonly "aria-expanded"?: boolean;
  readonly onClick?: (event: MouseEvent) => void;
};

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
  const contentId = useId();
  const currentOpen = controlled ? open : internalOpen;

  function setOpen(nextOpen: boolean): void {
    if (!controlled) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  }

  const trigger = children as ReactElement<ToggleTipTriggerProps>;

  return (
    <span className="iso-toggle-tip">
      {cloneElement(trigger, {
        "aria-controls": currentOpen ? contentId : undefined,
        "aria-expanded": currentOpen,
        onClick: (event: MouseEvent) => {
          trigger.props.onClick?.(event);
          if (!event.defaultPrevented) {
            setOpen(!currentOpen);
          }
        },
      })}
      {currentOpen ? (
        <span
          aria-modal="false"
          className="iso-toggle-tip__content"
          id={contentId}
          role="dialog"
        >
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
          <button
            aria-label={closeLabel}
            className="iso-toggle-tip__close"
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }}
          >
            <span aria-hidden="true">x</span>
          </button>
        </span>
      ) : null}
    </span>
  );
}
