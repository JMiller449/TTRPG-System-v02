import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { selectSheetTemplateViews } from "@/app/state/selectors";
import type { SheetTemplateView } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { TemplateList } from "@/features/sheets/components/TemplateList";
import { TemplateSearchBar } from "@/features/sheets/components/TemplateSearchBar";
import { toInstancedSheetCreationValues } from "@/features/sheets/templateEditorValues";
import { buildInstantiateSheetRequest } from "@/infrastructure/ws/requestBuilders";
import { Panel } from "@/shared/ui/Panel";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { makeId } from "@/shared/utils/id";
import { buildDeleteTemplateSubmission } from "@/features/sheets/templateLibraryRequests";

export function TemplateLibrary({ client }: { client: GameClient }): JSX.Element {
  const { state, dispatch } = useAppStore();
  const { templateSearch } = state.uiState;

  const [spawnCount, setSpawnCount] = useState<number>(1);

  const visibleTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    return selectSheetTemplateViews(state).filter((entry) => {
      if (!query) {
        return true;
      }

      return entry.name.toLowerCase().includes(query);
    });
  }, [state, templateSearch]);

  const beginEditTemplate = (template: SheetTemplateView): void => {
    dispatch({ type: "set_template_builder_sheet", sheetId: template.id });
    dispatch({ type: "set_gm_view", view: "create_template" });
  };

  const spawnTemplate = (template: SheetTemplateView): void => {
    const amount = Math.max(1, spawnCount);
    let activeInstanceId: string | null = null;

    for (let index = 0; index < amount; index += 1) {
      const instanceId = makeId("instance");
      activeInstanceId = instanceId;
      client.sendProtocolRequest(
        buildInstantiateSheetRequest(
          toInstancedSheetCreationValues(template.sheet, template.kind, instanceId)
        ),
        amount > 1 ? `Spawn ${template.name} ${index + 1}` : `Spawn ${template.name}`
      );
    }

    if (activeInstanceId) {
      dispatch({ type: "set_active_sheet_local", sheetId: activeInstanceId });
    }
  };

  const deleteTemplate = (template: SheetTemplateView): void => {
    const submission = buildDeleteTemplateSubmission(template);
    if (
      !confirmDestructiveAction({
        action: "Delete",
        subject: template.name,
        consequence:
          "This permanently deletes the template. Spawned-instance and encounter dependency checks still apply."
      })
    ) {
      return;
    }
    client.sendProtocolRequest(submission.request, submission.label);
  };

  return (
    <Panel
      title="Template Library"
      subtitle="Every sheet template in your world. Spawn playable copies or edit the original."
      actions={
        <button
          className="button button--secondary"
          onClick={() => {
            dispatch({ type: "set_template_builder_sheet", sheetId: null });
            dispatch({ type: "set_gm_view", view: "create_template" });
          }}
        >
          New Template
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
          onDelete={deleteTemplate}
        />
      </div>
    </Panel>
  );
}
