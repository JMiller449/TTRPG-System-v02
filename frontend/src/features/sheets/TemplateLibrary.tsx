import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/store";
import type { SheetKind, SheetTemplate, StatKey } from "@/domain/models";
import { Field } from "@/shared/ui/Field";
import { Panel } from "@/shared/ui/Panel";
import { EmptyState } from "@/shared/ui/EmptyState";
import { makeId } from "@/shared/utils/id";
import type { GameClient } from "@/hooks/useGameClient";
import {
  CORE_TEMPLATE_STATS,
  TemplateEditorForm,
  type TemplateEditorValues
} from "@/features/sheets/TemplateEditorForm";

function createEmptyValues(kind: SheetKind = "player"): TemplateEditorValues {
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

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseCoreStats(values: TemplateEditorValues["coreStats"]): Partial<Record<StatKey, number>> {
  return Object.fromEntries(
    Object.entries(values)
      .filter((entry) => entry[1].trim() !== "")
      .map(([key, raw]) => [key, Number(raw)])
      .filter((entry) => Number.isFinite(entry[1]))
  ) as Partial<Record<StatKey, number>>;
}

function toEditorValues(template: SheetTemplate): TemplateEditorValues {
  const base = createEmptyValues(template.kind);
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

export function TemplateLibrary({ client }: { client: GameClient }): JSX.Element {
  const {
    state: { templates, templateOrder, templateSearch },
    dispatch
  } = useAppStore();

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<TemplateEditorValues>(() => createEmptyValues("player"));
  const [spawnCount, setSpawnCount] = useState<number>(1);

  const visibleTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    return templateOrder
      .map((id) => templates[id])
      .filter((entry): entry is SheetTemplate => Boolean(entry))
      .filter((entry) => {
        if (!query) {
          return true;
        }
        return (
          entry.name.toLowerCase().includes(query) ||
          entry.tags.some((tag) => tag.toLowerCase().includes(query))
        );
      });
  }, [templateOrder, templates, templateSearch]);

  const beginEditTemplate = (template: SheetTemplate): void => {
    setEditingTemplateId(template.id);
    setEditValues(toEditorValues(template));
  };

  const saveTemplateEdit = (): void => {
    if (!editingTemplateId || !editValues.name.trim()) {
      return;
    }

    client.sendIntent({
      intentId: makeId("intent"),
      type: "update_template",
      payload: {
        templateId: editingTemplateId,
        changes: {
          kind: editValues.kind,
          name: editValues.name.trim(),
          notes: editValues.notes.trim(),
          tags: parseTags(editValues.tags),
          stats: parseCoreStats(editValues.coreStats)
        }
      }
    });

    setEditingTemplateId(null);
    setEditValues(createEmptyValues("player"));
  };

  const instantiate = (templateId: string): void => {
    client.sendIntent({
      intentId: makeId("intent"),
      type: "instantiate_template",
      payload: { templateId, count: Math.max(1, spawnCount) }
    });
  };

  return (
    <Panel
      title="Template Library"
      actions={
        <button
          className="button button--secondary"
          onClick={() => dispatch({ type: "set_gm_view", view: "create_template" })}
        >
          Create Template Page
        </button>
      }
    >
      <div className="stack">
        <Field label="Search Templates">
          <input
            value={templateSearch}
            onChange={(event) => dispatch({ type: "set_template_search", value: event.target.value })}
            placeholder="Search by name or tag"
          />
        </Field>

        <Field label="Spawn Count">
          <input
            type="number"
            min={1}
            value={spawnCount}
            onChange={(event) => setSpawnCount(Number(event.target.value) || 1)}
          />
        </Field>

        <div className="list">
          {visibleTemplates.length === 0 ? <EmptyState message="No templates found." /> : null}
          {visibleTemplates.map((template) => (
            <article key={template.id} className="list-item">
              <div>
                <strong>{template.name}</strong>
                <div className="muted">
                  {template.kind} template · tags: {template.tags.join(", ") || "none"}
                </div>
              </div>
              <div className="inline-actions">
                <button className="button button--secondary" onClick={() => beginEditTemplate(template)}>
                  Edit
                </button>
                <button className="button button--secondary" onClick={() => instantiate(template.id)}>
                  Spawn
                </button>
              </div>
            </article>
          ))}
        </div>

        {editingTemplateId ? (
          <TemplateEditorForm
            title={`Edit Template (${templates[editingTemplateId]?.name ?? editingTemplateId})`}
            submitLabel="Save Template"
            values={editValues}
            onChange={setEditValues}
            onSubmit={saveTemplateEdit}
            onCancel={() => setEditingTemplateId(null)}
          />
        ) : null}
      </div>
    </Panel>
  );
}
