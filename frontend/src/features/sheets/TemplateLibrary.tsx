import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/store";
import { selectSheetTemplateViews } from "@/app/state/selectors";
import type { SheetTemplateView } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { TemplateEditPanel } from "@/features/sheets/components/TemplateEditPanel";
import { TemplateList } from "@/features/sheets/components/TemplateList";
import { TemplateSearchBar } from "@/features/sheets/components/TemplateSearchBar";
import type { TemplateEditorValues } from "@/features/sheets/TemplateEditorForm";
import {
  createEmptyTemplateEditorValues,
  toInstancedSheetCreationValues,
  toTemplateEditorValues,
  toUpdatedSheetDefinitionPayload
} from "@/features/sheets/templateEditorValues";
import {
  buildCreateInstancedSheetRequest,
  buildUpdateSheetRequest
} from "@/infrastructure/ws/requestBuilders";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

export function TemplateLibrary({ client }: { client: GameClient }): JSX.Element {
  const {
    state,
    dispatch
  } = useAppStore();
  const { templateSearch } = state.uiState;

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
    setEditValues(toTemplateEditorValues(template.sheet, state.serverState.sheetPresentation[template.id]));
  };

  const saveTemplateEdit = (): void => {
    if (!editingTemplateId || !editValues.name.trim()) {
      return;
    }

    const sheet = state.serverState.sheets[editingTemplateId];
    if (!sheet) {
      return;
    }

    client.sendProtocolRequest(
      buildUpdateSheetRequest({
        sheetId: editingTemplateId,
        sheet: toUpdatedSheetDefinitionPayload(sheet, editValues)
      }),
      "Update template"
    );
    setEditingTemplateId(null);
    setEditValues(createEmptyTemplateEditorValues("player"));
  };

  const spawnTemplate = (template: SheetTemplateView): void => {
    const amount = Math.max(1, spawnCount);
    let activeInstanceId: string | null = null;

    for (let index = 0; index < amount; index += 1) {
      const instanceId = makeId("instance");
      activeInstanceId = instanceId;
      client.sendProtocolRequest(
        buildCreateInstancedSheetRequest(
          toInstancedSheetCreationValues(template.sheet, template.kind, instanceId)
        ),
        amount > 1 ? `Spawn ${template.name} ${index + 1}` : `Spawn ${template.name}`
      );
    }

    if (activeInstanceId) {
      dispatch({ type: "set_active_sheet_local", sheetId: activeInstanceId });
    }
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
          onSpawn={spawnTemplate}
        />

        <TemplateEditPanel
          editingTemplateId={editingTemplateId}
          editingTemplateName={editingTemplateId ? state.serverState.sheets[editingTemplateId]?.name : undefined}
          values={editValues}
          onChange={setEditValues}
          onSubmit={saveTemplateEdit}
          onCancel={() => setEditingTemplateId(null)}
        />
      </div>
    </Panel>
  );
}
