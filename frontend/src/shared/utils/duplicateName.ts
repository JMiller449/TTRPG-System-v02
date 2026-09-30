function splitNumericSuffix(name: string): { base: string; next: number } {
  const trimmed = name.trim();
  const match = /^(.*?)(\d+)$/.exec(trimmed);
  if (!match || !match[1]) {
    return { base: trimmed, next: 1 };
  }
  return { base: match[1], next: Number(match[2]) + 1 };
}

export function nextDuplicateName(sourceName: string, existingNames: readonly string[]): string {
  const { base, next: initialSuffix } = splitNumericSuffix(sourceName);
  const normalizedNames = new Set(existingNames.map((name) => name.trim().toLocaleLowerCase()));
  let suffix = initialSuffix;
  while (normalizedNames.has(`${base}${suffix}`.toLocaleLowerCase())) {
    suffix += 1;
  }
  return `${base}${suffix}`;
}
