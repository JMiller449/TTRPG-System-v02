export function deriveSnapshotTemplateId(name: string, existingIds: Iterable<string>): string {
  const ids = new Set(existingIds);
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const baseId = slug || "sheet_snapshot";
  if (!ids.has(baseId)) {
    return baseId;
  }
  let suffix = 2;
  while (ids.has(`${baseId}_${suffix}`)) {
    suffix += 1;
  }
  return `${baseId}_${suffix}`;
}
