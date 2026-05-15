import { Steps } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { IsoIcon } from "../icons/IsoIcon";

export type IsoStepStatus =
  | "pending"
  | "current"
  | "complete"
  | "error"
  | "loading"
  | "locked"
  | "skipped";

export interface IsoStepItem {
  readonly description?: ReactNode;
  readonly disabled?: boolean;
  readonly id: string;
  readonly meta?: ReactNode;
  readonly status?: IsoStepStatus;
  readonly title: ReactNode;
}

export interface IsoStepsProps {
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly currentStepId?: string;
  readonly items: readonly IsoStepItem[];
  readonly onStepSelect?: (stepId: string) => void;
  readonly orientation?: "vertical" | "horizontal";
  readonly size?: "sm" | "md";
}

export function IsoSteps({
  ariaLabel,
  className,
  currentStepId,
  items,
  onStepSelect,
  orientation = "vertical",
  size = "sm",
}: IsoStepsProps): JSX.Element {
  const currentStepIndex = Math.max(
    0,
    items.findIndex((item) => item.id === currentStepId),
  );
  const clickable = Boolean(onStepSelect);

  return (
    <Steps.Root
      className={[
        "iso-steps",
        `iso-steps-${orientation}`,
        `iso-steps-${size}`,
        clickable ? "iso-steps-clickable" : "iso-steps-static",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      colorPalette="blue"
      count={items.length}
      orientation={orientation}
      size={size}
      step={currentStepIndex}
      variant="subtle"
    >
      <Steps.List aria-label={ariaLabel} className="iso-steps-list">
        {items.map((item, index) => {
          const status = getItemStatus(item, currentStepId);
          const disabled = item.disabled || status === "locked";
          const current = item.id === currentStepId || status === "current";
          const rowClassName = [
            "iso-steps-row",
            `iso-steps-row-${status}`,
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <Steps.Item
              className="iso-steps-item"
              data-status={status}
              index={index}
              key={item.id}
            >
              {clickable ? (
                <Steps.Trigger asChild>
                  <button
                    className={rowClassName}
                    disabled={disabled}
                    type="button"
                    onClick={() => onStepSelect?.(item.id)}
                  >
                    <IsoStepContent
                      item={item}
                      stepNumber={index + 1}
                      status={status}
                    />
                  </button>
                </Steps.Trigger>
              ) : (
                <div
                  aria-current={current ? "step" : undefined}
                  aria-disabled={disabled || undefined}
                  className={rowClassName}
                >
                  <IsoStepContent
                    item={item}
                    stepNumber={index + 1}
                    status={status}
                  />
                </div>
              )}
              {index < items.length - 1 ? (
                <Steps.Separator className="iso-steps-separator" />
              ) : null}
            </Steps.Item>
          );
        })}
      </Steps.List>
    </Steps.Root>
  );
}

function IsoStepContent({
  item,
  stepNumber,
  status,
}: {
  readonly item: IsoStepItem;
  readonly stepNumber: number;
  readonly status: IsoStepStatus;
}): JSX.Element {
  return (
    <>
      <Steps.Indicator className="iso-steps-indicator">
        <IsoStepMarker stepNumber={stepNumber} status={status} />
      </Steps.Indicator>
      <span className="iso-steps-copy">
        <Steps.Title className="iso-steps-title">{item.title}</Steps.Title>
        {item.description ? (
          <Steps.Description className="iso-steps-description">
            {item.description}
          </Steps.Description>
        ) : null}
        {item.meta ? <span className="iso-steps-meta">{item.meta}</span> : null}
      </span>
    </>
  );
}

function IsoStepMarker({
  stepNumber,
  status,
}: {
  readonly stepNumber: number;
  readonly status: IsoStepStatus;
}): JSX.Element {
  if (status === "current" || status === "loading") {
    return <span aria-hidden="true" className="iso-steps-spinner" />;
  }

  if (status === "complete") {
    return <IsoIcon name="tick" size={14} strokeWidth={2} />;
  }

  if (status === "error") {
    return <IsoIcon name="warning" size={14} strokeWidth={2} />;
  }

  return <span className="iso-steps-number">{stepNumber}</span>;
}

function getItemStatus(
  item: IsoStepItem,
  currentStepId: string | undefined,
): IsoStepStatus {
  if (item.status) {
    return item.status;
  }

  if (item.disabled) {
    return "locked";
  }

  if (currentStepId && item.id === currentStepId) {
    return "current";
  }

  return "pending";
}
