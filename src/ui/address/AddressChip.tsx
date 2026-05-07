import { IsoAddressAvatar } from "../../ui-kit/identity/IsoAddressAvatar";
import {
  getAddressValidationTone,
  shortenAddress,
  type AddressStateTone,
  type AddressValidationStatus,
} from "./address-utils";

export interface AddressChipProps {
  readonly className?: string;
  readonly duplicate?: boolean;
  readonly label?: string;
  readonly message?: string;
  readonly onRemove?: () => void;
  readonly removeLabel?: string;
  readonly size?: "normal" | "compact";
  readonly status?: AddressValidationStatus;
  readonly value: string;
}

export function AddressChip({
  className,
  duplicate = false,
  label,
  message,
  onRemove,
  removeLabel,
  size = "normal",
  status = "valid",
  value,
}: AddressChipProps): JSX.Element {
  const tone = getChipTone(status, duplicate);
  const stateLabel = duplicate ? "Duplicate" : getStatusLabel(status);
  const displayValue = label ?? shortenAddress(value);
  const title = label ? `${label} (${value})` : value;

  return (
    <span
      className={[
        "address-chip",
        `address-chip-${size}`,
        `iso-state-${tone}`,
        duplicate ? "address-chip-duplicate" : undefined,
        status !== "valid" ? "address-chip-invalid" : undefined,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={message ? `${title}: ${message}` : title}
    >
      <IsoAddressAvatar value={value} />
      <span className="address-chip-value">{displayValue}</span>
      {stateLabel ? <span className="address-chip-state">{stateLabel}</span> : null}
      {onRemove ? (
        <button
          aria-label={removeLabel ?? `Remove ${displayValue}`}
          className="address-chip-remove"
          type="button"
          onClick={onRemove}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

function getChipTone(
  status: AddressValidationStatus,
  duplicate: boolean,
): AddressStateTone {
  if (duplicate) {
    return "warning";
  }

  if (status === "valid") {
    return "neutral";
  }

  return getAddressValidationTone(status);
}

function getStatusLabel(status: AddressValidationStatus): string | undefined {
  switch (status) {
    case "invalid_checksum":
      return "Bad checksum";
    case "invalid_format":
      return "Invalid";
    case "zero_address":
      return "Zero";
    case "empty":
    case "valid":
      return undefined;
  }
}
