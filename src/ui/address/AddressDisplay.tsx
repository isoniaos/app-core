import { useMemo, useState } from "react";
import { AddressAvatar } from "./AddressAvatar";
import {
  shortenAddress,
  validateAddressInput,
  type AddressStateTone,
} from "./address-utils";

export interface AddressDisplayProps {
  readonly className?: string;
  readonly copyable?: boolean;
  readonly invalid?: boolean;
  readonly label?: string;
  readonly showAvatar?: boolean;
  readonly shorten?: boolean;
  readonly size?: "normal" | "compact";
  readonly value?: string;
}

export function AddressDisplay({
  className,
  copyable = false,
  invalid,
  label,
  showAvatar = true,
  shorten = true,
  size = "normal",
  value,
}: AddressDisplayProps): JSX.Element {
  const [copied, setCopied] = useState(false);
  const trimmedValue = value?.trim() ?? "";
  const validation = useMemo(
    () =>
      trimmedValue.length > 0
        ? validateAddressInput(trimmedValue, { allowZeroAddress: true })
        : undefined,
    [trimmedValue],
  );
  const isInvalid =
    invalid ??
    (/^0x/i.test(trimmedValue) &&
      validation !== undefined &&
      !validation.isValid);
  const tone: AddressStateTone = isInvalid ? "danger" : "neutral";
  const displaySource = validation?.normalizedAddress ?? trimmedValue;
  const displayValue =
    label ??
    (displaySource.length > 0
      ? shorten
        ? shortenAddress(displaySource)
        : displaySource
      : "Not set");
  const title = label && displaySource ? `${label} (${displaySource})` : displaySource;
  const copyValue = displaySource || label || "";

  async function copyToClipboard(): Promise<void> {
    if (!copyValue || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(copyValue);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <span
      className={[
        "address-display",
        `address-display-${size}`,
        `iso-state-${tone}`,
        isInvalid ? "address-display-invalid" : undefined,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={title || undefined}
    >
      {showAvatar ? (
        <AddressAvatar
          label={displaySource ? `Address ${displaySource}` : undefined}
          seed={label}
          value={displaySource}
        />
      ) : null}
      <span className="address-display-value">{displayValue}</span>
      {copyable && copyValue ? (
        <button
          className="address-copy-button"
          type="button"
          onClick={() => {
            void copyToClipboard();
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      ) : null}
    </span>
  );
}
