import type { ReactNode } from "react";

export type IsoStatusPillTone =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "muted";

export interface IsoStatusPillProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly tone?: IsoStatusPillTone;
}

export function IsoStatusPill({
  children,
  className,
  tone = "default",
}: IsoStatusPillProps): JSX.Element {
  return (
    <span
      className={["iso-status-pill", `iso-status-pill-${tone}`, className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
