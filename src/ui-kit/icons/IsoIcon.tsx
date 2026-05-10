import {
  AlertCircleIcon,
  Building02Icon,
  Blockchain06Icon,
  BulbIcon,
  Cancel01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  ComputerSettingsIcon,
  FileChartColumnIcon,
  HelpCircleIcon,
  HierarchySquare03Icon,
  Home01Icon,
  InformationCircleIcon,
  LeftToRightListBulletIcon,
  Moon02Icon,
  NewJobIcon,
  PlusSignCircleIcon,
  QuestionIcon,
  Settings02Icon,
  Sun01Icon,
  Tick02Icon,
  TimeQuarter02Icon,
  Wallet02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ComponentProps } from "react";

type HugeiconsIconProps = ComponentProps<typeof HugeiconsIcon>;

export type IsoIconName =
  | "add"
  | "building"
  | "cancel"
  | "check"
  | "graph"
  | "home"
  | "help"
  | "info"
  | "list"
  | "lightbulb"
  | "moon"
  | "proposals"
  | "question"
  | "setup"
  | "structure"
  | "sun"
  | "system"
  | "tick"
  | "warning"
  | "wallet"
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
  add: PlusSignCircleIcon,
  building: Building02Icon,
  cancel: Cancel01Icon,
  check: CheckmarkCircle02Icon,
  graph: Blockchain06Icon,
  home: Home01Icon,
  help: HelpCircleIcon,
  info: InformationCircleIcon,
  list: LeftToRightListBulletIcon,
  lightbulb: BulbIcon,
  moon: Moon02Icon,
  proposals: FileChartColumnIcon,
  question: QuestionIcon,
  setup: Settings02Icon,
  structure: HierarchySquare03Icon,
  sun: Sun01Icon,
  system: ComputerSettingsIcon,
  tick: Tick02Icon,
  warning: AlertCircleIcon,
  wallet: Wallet02Icon,
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
