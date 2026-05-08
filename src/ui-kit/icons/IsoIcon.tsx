import {
  AlertCircleIcon,
  BulbIcon,
  Cancel01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  HelpCircleIcon,
  InformationCircleIcon,
  QuestionIcon,
  Tick02Icon,
  NewJobIcon,
  TimeQuarter02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ComponentProps } from "react";

type HugeiconsIconProps = ComponentProps<typeof HugeiconsIcon>;

export type IsoIconName =
  | "cancel"
  | "check"
  | "help"
  | "info"
  | "lightbulb"
  | "question"
  | "tick"
  | "warning"
  | "job"
  | "x"
  | "timelock";

export interface IsoIconProps
  extends Omit<HugeiconsIconProps, "icon" | "size" | "strokeWidth"> {
  readonly label?: string;
  readonly name: IsoIconName;
  readonly size?: number;
  readonly strokeWidth?: number;
}

const ICONS = {
  cancel: Cancel01Icon,
  check: CheckmarkCircle02Icon,
  help: HelpCircleIcon,
  info: InformationCircleIcon,
  lightbulb: BulbIcon,
  question: QuestionIcon,
  tick: Tick02Icon,
  warning: AlertCircleIcon,
  x: CancelCircleIcon,
  job: NewJobIcon,
  timelock: TimeQuarter02Icon,
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
