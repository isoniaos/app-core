import { IsoIcon } from "../icons/IsoIcon";
import { useIsoColorMode } from "./useIsoColorMode";

export function ColorModeToggle(): JSX.Element {
  const { colorMode, cycleColorMode, resolvedColorMode } = useIsoColorMode();
  const label = getColorModeLabel(colorMode, resolvedColorMode);

  return (
    <button
      aria-label={label}
      className="color-mode-toggle"
      onClick={cycleColorMode}
      title={label}
      type="button"
    >
      <IsoIcon name={getColorModeIcon(colorMode, resolvedColorMode)} size={17} />
    </button>
  );
}

function getColorModeIcon(
  colorMode: ReturnType<typeof useIsoColorMode>["colorMode"],
  resolvedColorMode: ReturnType<typeof useIsoColorMode>["resolvedColorMode"],
) {
  if (colorMode === "system") {
    return "system";
  }

  return resolvedColorMode === "dark" ? "moon" : "sun";
}

function getColorModeLabel(
  colorMode: ReturnType<typeof useIsoColorMode>["colorMode"],
  resolvedColorMode: ReturnType<typeof useIsoColorMode>["resolvedColorMode"],
): string {
  if (colorMode === "system") {
    return `Theme: system (${resolvedColorMode}). Switch to light theme.`;
  }

  return resolvedColorMode === "dark"
    ? "Theme: dark. Switch to system theme."
    : "Theme: light. Switch to dark theme.";
}
