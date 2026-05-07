import { identicon } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";
import type { CSSProperties } from "react";
import { useMemo } from "react";
import { normalizeAddressInput } from "../../ui/address/address-utils";

export interface IsoAddressAvatarProps {
  readonly className?: string;
  readonly label?: string;
  readonly seed?: string;
  readonly size?: number | string;
  readonly value?: string;
}

export function IsoAddressAvatar({
  className,
  label,
  seed,
  size,
  value,
}: IsoAddressAvatarProps): JSX.Element {
  const seedValue = normalizeAvatarSeed(seed, value);
  const src = useMemo(
    () =>
      createAvatar(identicon, {
        seed: seedValue,
      }).toDataUri(),
    [seedValue],
  );
  const style = size
    ? ({ "--iso-address-size": toCssSize(size) } as CSSProperties)
    : undefined;

  return (
    <img
      alt={label ?? ""}
      aria-hidden={label ? undefined : true}
      className={["address-avatar", className].filter(Boolean).join(" ")}
      src={src}
      style={style}
    />
  );
}

function normalizeAvatarSeed(seed: string | undefined, value: string | undefined): string {
  const explicitSeed = seed?.trim();

  if (explicitSeed) {
    return explicitSeed.toLowerCase();
  }

  const trimmedValue = value?.trim() ?? "";
  const normalizedAddress = trimmedValue
    ? normalizeAddressInput(trimmedValue, { allowZeroAddress: true })
    : undefined;

  if (normalizedAddress) {
    return normalizedAddress.toLowerCase();
  }

  return trimmedValue.length > 0 ? trimmedValue.toLowerCase() : "empty-address";
}

function toCssSize(size: number | string): string {
  return typeof size === "number" ? `${size}px` : size;
}
