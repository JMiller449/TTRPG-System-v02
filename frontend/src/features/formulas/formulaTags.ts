import { DAMAGE_TYPES } from "@/domain/models";

export const COMMON_FORMULA_TAGS = [
  "check",
  "hit",
  "damage",
  "healing",
  "physical",
  "magical",
  ...DAMAGE_TYPES.map((damageType) => damageType.toLowerCase())
].filter((tag, index, tags) => tags.indexOf(tag) === index);

export function normalizeFormulaTag(tag: string): string {
  return tag.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeFormulaTags(tags: readonly string[]): string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();
  tags.forEach((tag) => {
    const value = normalizeFormulaTag(tag);
    if (!value || seen.has(value)) {
      return;
    }
    seen.add(value);
    normalized.push(value);
  });
  return normalized;
}

export function addFormulaTags(current: readonly string[], input: string): string[] {
  return normalizeFormulaTags([...current, ...input.split(",")]);
}

export function removeFormulaTag(current: readonly string[], tag: string): string[] {
  const normalizedTag = normalizeFormulaTag(tag);
  return normalizeFormulaTags(current).filter((value) => value !== normalizedTag);
}
