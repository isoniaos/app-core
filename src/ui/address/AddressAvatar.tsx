import type { CSSProperties } from "react";
import { normalizeAddressInput } from "./address-utils";

export interface AddressAvatarProps {
  readonly className?: string;
  readonly label?: string;
  readonly seed?: string;
  readonly size?: number | string;
  readonly value?: string;
}

interface IdenticonCell {
  readonly x: number;
  readonly y: number;
}

export function AddressAvatar({
  className,
  label,
  seed,
  size,
  value,
}: AddressAvatarProps): JSX.Element {
  const normalizedAddress = value
    ? normalizeAddressInput(value, { allowZeroAddress: true })
    : undefined;
  const seedValue = normalizeSeed(seed ?? normalizedAddress ?? value ?? "");
  const hash = hashSeed(seedValue);
  const cells = buildIdenticonCells(hash);
  const foreground = `hsl(${hash % 360} 56% 36%)`;
  const background = `hsl(${(hash + 34) % 360} 42% 91%)`;
  const style = size ? ({ "--iso-address-size": toCssSize(size) } as CSSProperties) : undefined;

  return (
    <svg
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={["address-avatar", className].filter(Boolean).join(" ")}
      role={label ? "img" : undefined}
      style={style}
      viewBox="0 0 5 5"
    >
      <rect fill={background} height="5" width="5" x="0" y="0" />
      {cells.map((cell) => (
        <rect
          fill={foreground}
          height="1"
          key={`${cell.x}-${cell.y}`}
          width="1"
          x={cell.x}
          y={cell.y}
        />
      ))}
    </svg>
  );
}

function buildIdenticonCells(hash: number): readonly IdenticonCell[] {
  const cells: IdenticonCell[] = [];
  let cursor = hash;

  for (let y = 0; y < 5; y += 1) {
    for (let x = 0; x < 3; x += 1) {
      cursor = nextHash(cursor);

      if ((cursor & 1) === 0) {
        continue;
      }

      cells.push({ x, y });

      const mirroredX = 4 - x;
      if (mirroredX !== x) {
        cells.push({ x: mirroredX, y });
      }
    }
  }

  return cells;
}

function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function nextHash(value: number): number {
  return (Math.imul(value, 1664525) + 1013904223) >>> 0;
}

function normalizeSeed(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : "empty-address";
}

function toCssSize(size: number | string): string {
  return typeof size === "number" ? `${size}px` : size;
}
