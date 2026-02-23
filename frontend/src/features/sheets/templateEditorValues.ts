import type { SheetKind, SheetTemplate, StatKey } from "@/domain/models";
import { CORE_TEMPLATE_STATS, type TemplateEditorValues } from "@/features/sheets/TemplateEditorForm";

export function createEmptyTemplateEditorValues(kind: SheetKind = "player"): TemplateEditorValues {
  return {
    kind,
    name: "",
    notes: "",
    tags: kind,
    coreStats: CORE_TEMPLATE_STATS.reduce(
      (acc, key) => ({ ...acc, [key]: "" }),
      {} as TemplateEditorValues["coreStats"]
    )
  };
}

export function parseTemplateTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function parseTemplateCoreStats(
  values: TemplateEditorValues["coreStats"]
): Partial<Record<StatKey, number>> {
  return Object.fromEntries(
    Object.entries(values)
      .filter((entry) => entry[1].trim() !== "")
      .map(([key, raw]) => [key, Number(raw)])
      .filter((entry) => Number.isFinite(entry[1]))
  ) as Partial<Record<StatKey, number>>;
}

export function toTemplateEditorValues(template: SheetTemplate): TemplateEditorValues {
  const base = createEmptyTemplateEditorValues(template.kind);
  CORE_TEMPLATE_STATS.forEach((key) => {
    base.coreStats[key] = String(template.stats[key] ?? "");
  });

  return {
    ...base,
    kind: template.kind,
    name: template.name,
    notes: template.notes,
    tags: template.tags.join(", ")
  };
}

export function toTemplateChanges(values: TemplateEditorValues): Partial<SheetTemplate> {
  return {
    kind: values.kind,
    name: values.name.trim(),
    notes: values.notes.trim(),
    tags: parseTemplateTags(values.tags),
    stats: parseTemplateCoreStats(values.coreStats)
  };
}
