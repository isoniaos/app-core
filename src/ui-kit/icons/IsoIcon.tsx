import {
  AlertCircleIcon,
  BulbIcon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  QuestionIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ComponentProps } from "react";

type HugeiconsIconProps = ComponentProps<typeof HugeiconsIcon>;

export type IsoIconName =
  | "check"
  | "info"
  | "lightbulb"
  | "question"
  | "warning"
  | "x";

export interface IsoIconProps
  extends Omit<HugeiconsIconProps, "icon" | "size" | "strokeWidth"> {
  readonly label?: string;
  readonly name: IsoIconName;
  readonly size?: number;
  readonly strokeWidth?: number;
}

const ICONS = {
  check: CheckmarkCircle02Icon,
  info: InformationCircleIcon,
  lightbulb: BulbIcon,
  question: QuestionIcon,
  warning: AlertCircleIcon,
  x: CancelCircleIcon,
} satisfies Record<IsoIconName, HugeiconsIconProps["icon"]>;

export function IsoIcon({
  className,
  color = "currentColor",
  label,
  name,
  size = 18,
  strokeWidth = 1.7,
  ...props
}: IsoIconProps): JSX.Element {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={["iso-icon", className].filter(Boolean).join(" ")}
      role={label ? "img" : undefined}
    >
      <HugeiconsIcon
        color={color}
        icon={ICONS[name]}
        size={size}
        strokeWidth={strokeWidth}
        {...props}
      />
    </span>
  );
}
