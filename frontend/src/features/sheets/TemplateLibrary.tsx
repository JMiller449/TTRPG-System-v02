import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { selectSheetTemplateViews } from "@/app/state/selectors";
import type { SheetTemplateView } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { TemplateListItem } from "@/features/sheets/components/TemplateListItem";
import { CatalogBrowser } from "@/features/catalogs/CatalogBrowser";
import { useCatalogCreationTarget } from "@/features/catalogs/useCatalogCreationTarget";
import { toInstancedSheetCreationValues } from "@/features/sheets/templateEditorValues";
import { buildInstantiateSheetRequest } from "@/infrastructure/ws/requestBuilders";
import { Panel } from "@/shared/ui/Panel";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { makeId } from "@/shared/utils/id";
import { buildDeleteTemplateSubmission } from "@/features/sheets/templateLibraryRequests";
import { Field } from "@/shared/ui/Field";

export function TemplateLibrary({ client }: { client: GameClient }): JSX.Element {
  const { state, dispatch } = useAppStore();
  const [spawnCount, setSpawnCount] = useState<number>(1);

  const templates = useMemo(() => selectSheetTemplateViews(state), [state]);
  const templatesById = useMemo(
    () => Object.fromEntries(templates.map((template) => [template.id, template])),
    [templates]
  );
  const { beginCreation } = useCatalogCreationTarget({
    catalog: "sheet_templates",
    client,
    entries: state.serverState.sheets
  });

  const beginEditTemplate = (template: SheetTemplateView): void => {
    beginCreation(null);
    dispatch({ type: "set_template_builder_sheet", sheetId: template.id });
    dispatch({ type: "set_gm_view", view: "create_template" });
  };

  const beginCreateTemplate = (folderId: string | null): void => {
    beginCreation(folderId);
    dispatch({ type: "set_template_builder_sheet", sheetId: null });
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
        <button className="button button--secondary" onClick={() => beginCreateTemplate(null)}>
          New Template
        </button>
      }
    >
      <div className="stack">
        <Field label="Spawn Count">
          <input
            type="number"
            min={1}
            value={spawnCount}
            onChange={(event) => setSpawnCount(Number(event.target.value) || 1)}
          />
        </Field>
        <CatalogBrowser
          catalog="sheet_templates"
          client={client}
          items={templates.map((template) => ({
            id: template.id,
            name: template.name,
            searchText: template.kind
          }))}
          selectedId={state.uiState.templateBuilderSheetId}
          entityLabel="template"
          emptyMessage="No templates found."
          onCreateEntry={beginCreateTemplate}
          onSelect={(templateId) => {
            const template = templatesById[templateId];
            if (template) {
              beginEditTemplate(template);
            }
          }}
          renderEntry={(item) => {
            const template = templatesById[item.id];
            return template ? (
              <TemplateListItem
                template={template}
                onEdit={() => beginEditTemplate(template)}
                onSpawn={() => spawnTemplate(template)}
                onDelete={() => deleteTemplate(template)}
              />
            ) : null;
          }}
        />
      </div>
    </Panel>
  );
}
