import { useMemo } from "react";
import { useIsoToast } from "../feedback/useIsoToast";
import { IsoAddressAvatar } from "./IsoAddressAvatar";
import {
  shortenAddress,
  validateAddressInput,
  type AddressStateTone,
} from "../../ui/address/address-utils";

export interface IsoAddressDisplayProps {
  readonly className?: string;
  readonly copyable?: boolean;
  readonly invalid?: boolean;
  readonly label?: string;
  readonly showAvatar?: boolean;
  readonly shorten?: boolean;
  readonly size?: "normal" | "compact";
  readonly value?: string;
}

export function IsoAddressDisplay({
  className,
  copyable = false,
  invalid,
  label,
  showAvatar = true,
  shorten = true,
  size = "normal",
  value,
}: IsoAddressDisplayProps): JSX.Element {
  const toast = useIsoToast();
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
  const title =
    label && displaySource ? `${label} (${displaySource})` : displaySource;
  const copyValue = displaySource;
  const copyEnabled = copyable && copyValue.length > 0;
  const classNames = [
    "address-display",
    `address-display-${size}`,
    `iso-state-${tone}`,
    copyEnabled ? "address-display-copyable" : undefined,
    isInvalid ? "address-display-invalid" : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  async function copyToClipboard(): Promise<void> {
    if (!navigator.clipboard?.writeText) {
      toast.error("Clipboard unavailable");
      return;
    }

    try {
      await navigator.clipboard.writeText(copyValue);
      toast.success("Address copied");
    } catch (_error) {
      toast.error("Unable to copy address");
    }
  }

  const content = (
    <>
      {showAvatar ? (
        <IsoAddressAvatar
          label={displaySource ? `Address ${displaySource}` : undefined}
          seed={label}
          value={displaySource}
        />
      ) : null}
      <span className="address-display-value">{displayValue}</span>
    </>
  );

  if (copyEnabled) {
    return (
      <button
        aria-label={`Copy address ${copyValue}`}
        className={classNames}
        title={title || copyValue}
        type="button"
        onClick={() => {
          void copyToClipboard();
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <span className={classNames} title={title || undefined}>
      {content}
    </span>
  );
}
