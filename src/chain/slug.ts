export function buildOrganizationSlug(fallbackName: string): string {
  const source = fallbackName.trim();
  const slug = normalizeOrganizationSlug(source);

  if (slug.length > 0) {
    return slug;
  }

  if (source.length === 0) {
    return "organization";
  }

  return `org-${hashSlugSource(source)}`;
}

export function normalizeOrganizationSlug(value: string): string {
  return value
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function validateOrganizationSlug(value: string): string | undefined {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return "Organization slug is required.";
  }

  if (trimmed.length > 80) {
    return "Organization slug must be 80 characters or fewer.";
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) {
    return "Use lowercase Latin letters, numbers, and single hyphens.";
  }

  return undefined;
}

function hashSlugSource(source: string): string {
  let hash = 2_166_136_261;

  for (const character of source) {
    const codePoint = character.codePointAt(0) ?? 0;
    hash ^= codePoint;
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0).toString(36).padStart(6, "0").slice(0, 8);
}
