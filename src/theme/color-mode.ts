export type IsoColorMode = "light" | "dark" | "system";
export type IsoResolvedColorMode = Exclude<IsoColorMode, "system">;

export const ISO_COLOR_MODE_STORAGE_KEY = "isonia-color-mode";
export const ISO_COLOR_MODE_ATTRIBUTE = "data-theme";
export const ISO_COLOR_MODE_DATA_ATTRIBUTE = "isoniaColorMode";

export const ISO_COLOR_MODES: readonly IsoColorMode[] = [
  "light",
  "dark",
  "system",
] as const;

export function isIsoColorMode(value: unknown): value is IsoColorMode {
  return (
    value === "light" ||
    value === "dark" ||
    value === "system"
  );
}

export function isIsoResolvedColorMode(
  value: unknown,
): value is IsoResolvedColorMode {
  return value === "light" || value === "dark";
}

export function getInitialIsoResolvedColorMode(): IsoResolvedColorMode {
  return resolveIsoColorMode(readStoredIsoColorMode());
}

export function readStoredIsoColorMode(): IsoColorMode {
  if (typeof window === "undefined") {
    return "light";
  }

  try {
    const storedMode = window.localStorage.getItem(ISO_COLOR_MODE_STORAGE_KEY);
    return isIsoColorMode(storedMode) ? storedMode : "light";
  } catch {
    return "light";
  }
}

export function resolveIsoColorMode(mode: IsoColorMode): IsoResolvedColorMode {
  if (mode === "light" || mode === "dark") {
    return mode;
  }

  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }

  return "light";
}
