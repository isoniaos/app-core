export function formatLabel(value: string): string {
  return value
    .replace(/[_-]/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

export function formatAddress(value: string): string {
  if (value.length <= 14) {
    return value;
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function formatChainTime(value?: string): string {
  if (!value) {
    return "Not set";
  }

  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(seconds * 1000));
}

export function formatNumericString(value?: string): string {
  if (!value) {
    return "Not set";
  }

  try {
    return BigInt(value).toLocaleString();
  } catch {
    return value;
  }
}
