import type { ReactNode } from "react";

export interface IsoSegmentedControlItem {
  readonly disabled?: boolean;
  readonly icon?: ReactNode;
  readonly label: ReactNode;
  readonly value: string;
}

export interface IsoSegmentedControlProps {
  readonly ariaLabel: string;
  readonly items: readonly IsoSegmentedControlItem[];
  readonly onValueChange: (value: string) => void;
  readonly size?: "sm" | "md";
  readonly value: string;
}

export function IsoSegmentedControl({
  ariaLabel,
  items,
  onValueChange,
  size = "md",
  value,
}: IsoSegmentedControlProps): JSX.Element {
  return (
    <div
      aria-label={ariaLabel}
      className={`iso-segmented-control iso-segmented-control-${size}`}
      role="group"
    >
      {items.map((item) => {
        const selected = item.value === value;

        return (
          <button
            aria-pressed={selected}
            className="iso-segmented-control-item"
            disabled={item.disabled}
            key={item.value}
            type="button"
            onClick={() => onValueChange(item.value)}
          >
            {item.icon ? (
              <span className="iso-segmented-control-icon" aria-hidden="true">
                {item.icon}
              </span>
            ) : null}
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
