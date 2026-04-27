export function requireParam(
  value: string | undefined,
  name: string,
): string {
  if (!value) {
    throw new Error(`Missing route parameter: ${name}`);
  }
  return value;
}

