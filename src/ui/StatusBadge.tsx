import type { DataStatus } from "@isonia/types";
import { formatLabel } from "../utils/format";

type BadgeTone = "default" | "success" | "warning" | "danger" | "muted";

export function Badge({
  children,
}: {
  readonly children: React.ReactNode;
}): JSX.Element {
  return <span className="badge badge-muted">{children}</span>;
}

export function StatusBadge({
  children,
  tone = "default",
}: {
  readonly children: React.ReactNode;
  readonly tone?: BadgeTone;
}): JSX.Element {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function DataStatusBadge({
  status,
}: {
  readonly status?: DataStatus;
}): JSX.Element {
  return (
    <StatusBadge tone={status === "confirmed" ? "success" : "warning"}>
      {status ? formatLabel(status) : "Observed"}
    </StatusBadge>
  );
}

