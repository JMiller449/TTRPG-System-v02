import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/store";
import { selectSheetTemplateViews } from "@/app/state/selectors";
import type { SheetTemplateView } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { TemplateEditPanel } from "@/features/sheets/components/TemplateEditPanel";
import { TemplateList } from "@/features/sheets/components/TemplateList";
import { TemplateSearchBar } from "@/features/sheets/components/TemplateSearchBar";
import {
  buildInstantiateSheetIntent,
  buildUpdateSheetIntent
} from "@/features/sheets/intentBuilders";
import type { TemplateEditorValues } from "@/features/sheets/TemplateEditorForm";
import { Panel } from "@/shared/ui/Panel";
import {
  createEmptyTemplateEditorValues,
  toSheetChanges,
  toSheetPresentation,
  toTemplateEditorValues
} from "@/features/sheets/templateEditorValues";

export function TemplateLibrary({ client }: { client: GameClient }): JSX.Element {
  const {
    state,
    dispatch
  } = useAppStore();
  const { templateSearch } = state;

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<TemplateEditorValues>(() =>
    createEmptyTemplateEditorValues("player")
  );
  const [spawnCount, setSpawnCount] = useState<number>(1);

  const visibleTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    return selectSheetTemplateViews(state)
      .filter((entry) => {
        if (!query) {
          return true;
        }

        return (
          entry.name.toLowerCase().includes(query) ||
          entry.tags.some((tag) => tag.toLowerCase().includes(query))
        );
      });
  }, [state, templateSearch]);

  const beginEditTemplate = (template: SheetTemplateView): void => {
    setEditingTemplateId(template.id);
    setEditValues(toTemplateEditorValues(template.sheet, state.sheetPresentation[template.id]));
  };

  const saveTemplateEdit = (): void => {
    if (!editingTemplateId || !editValues.name.trim()) {
      return;
    }

    client.sendIntent(
      buildUpdateSheetIntent(editingTemplateId, toSheetChanges(editValues), toSheetPresentation(editValues))
    );
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
          onSpawn={(template) => client.sendIntent(buildInstantiateSheetIntent(template.id, spawnCount))}
        />

        <TemplateEditPanel
          editingTemplateId={editingTemplateId}
          editingTemplateName={editingTemplateId ? state.sheets[editingTemplateId]?.name : undefined}
          values={editValues}
          onChange={setEditValues}
          onSubmit={saveTemplateEdit}
          onCancel={() => setEditingTemplateId(null)}
        />
      </div>
    </Panel>
  );
}
