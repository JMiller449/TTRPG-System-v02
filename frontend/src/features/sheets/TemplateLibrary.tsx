import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/store";
import type { SheetTemplate } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { TemplateEditPanel } from "@/features/sheets/components/TemplateEditPanel";
import { TemplateList } from "@/features/sheets/components/TemplateList";
import { TemplateSearchBar } from "@/features/sheets/components/TemplateSearchBar";
import {
  buildInstantiateTemplateIntent,
  buildUpdateTemplateIntent
} from "@/features/sheets/intentBuilders";
import type { TemplateEditorValues } from "@/features/sheets/TemplateEditorForm";
import { Panel } from "@/shared/ui/Panel";
import {
  createEmptyTemplateEditorValues,
  toTemplateChanges,
  toTemplateEditorValues
} from "@/features/sheets/templateEditorValues";

export function TemplateLibrary({ client }: { client: GameClient }): JSX.Element {
  const {
    state: { templates, templateOrder, templateSearch },
    dispatch
  } = useAppStore();

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<TemplateEditorValues>(() =>
    createEmptyTemplateEditorValues("player")
  );
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
    setEditValues(toTemplateEditorValues(template));
  };

  const saveTemplateEdit = (): void => {
    if (!editingTemplateId || !editValues.name.trim()) {
      return;
    }

    client.sendIntent(buildUpdateTemplateIntent(editingTemplateId, toTemplateChanges(editValues)));
    setEditingTemplateId(null);
    setEditValues(createEmptyTemplateEditorValues("player"));
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
        <TemplateSearchBar
          search={templateSearch}
          spawnCount={spawnCount}
          onSearchChange={(value) => dispatch({ type: "set_template_search", value })}
          onSpawnCountChange={setSpawnCount}
        />

        <TemplateList
          templates={visibleTemplates}
          onEdit={beginEditTemplate}
          onSpawn={(template) => client.sendIntent(buildInstantiateTemplateIntent(template.id, spawnCount))}
        />

        <TemplateEditPanel
          editingTemplateId={editingTemplateId}
          editingTemplateName={editingTemplateId ? templates[editingTemplateId]?.name : undefined}
          values={editValues}
          onChange={setEditValues}
          onSubmit={saveTemplateEdit}
          onCancel={() => setEditingTemplateId(null)}
        />
      </div>
    </Panel>
  );
}
