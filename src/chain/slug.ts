export function buildOrganizationSlug(fallbackName: string): string {
  const source = fallbackName.trim();
  const slug = source
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length > 0) {
    return slug;
  }

  if (source.length === 0) {
    return "organization";
  }

  return `org-${hashSlugSource(source)}`;
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
