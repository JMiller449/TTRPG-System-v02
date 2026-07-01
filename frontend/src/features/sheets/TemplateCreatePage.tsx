import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { buildLoadActionFormulaAuthoringMetadataSubmission } from "@/features/actions/actionAuthoringRequests";
import { TemplateEditorForm } from "@/features/sheets/TemplateEditorForm";
import type { TemplateEditorValues } from "@/features/sheets/templateEditorTypes";
import {
  createEmptyTemplateEditorValues,
  toSheetDefinitionPayload,
  toTemplateEditorValues,
  validateTemplateEditorValues
} from "@/features/sheets/templateEditorValues";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildCreateSheetRequest,
  buildUpdateSheetRequest
} from "@/infrastructure/ws/requestBuilders";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

interface PendingTemplateSave {
  requestId: string;
}

export function TemplateCreatePage({ client }: { client: GameClient }): JSX.Element {
  const { state, dispatch } = useAppStore();
  const {
    actions,
    actionOrder,
    proficiencies,
    proficiencyOrder,
    items,
    itemOrder,
    sheets
  } = state.serverState;
  const {
    templateBuilderSheetId,
    actionFormulaAuthoringMetadata,
    intentFeedback
  } = state.uiState;
  const sourceSheet = templateBuilderSheetId ? sheets[templateBuilderSheetId] : undefined;
  const [values, setValues] = useState<TemplateEditorValues>(() =>
    sourceSheet ? toTemplateEditorValues(sourceSheet) : createEmptyTemplateEditorValues("player")
  );
  const [pendingSave, setPendingSave] = useState<PendingTemplateSave | null>(null);
  const loadedSheetIdRef = useRef<string | null | undefined>(undefined);
  const requestedMetadataRef = useRef(false);
  const catalogs = useMemo(
    () => ({ actions, proficiencies, items }),
    [actions, items, proficiencies]
  );

  useEffect(() => {
    if (loadedSheetIdRef.current === templateBuilderSheetId) {
      return;
    }
    loadedSheetIdRef.current = templateBuilderSheetId;
    setValues(
      templateBuilderSheetId && sheets[templateBuilderSheetId]
        ? toTemplateEditorValues(sheets[templateBuilderSheetId])
        : createEmptyTemplateEditorValues("player")
    );
  }, [sheets, templateBuilderSheetId]);

  useEffect(() => {
    if (!templateBuilderSheetId || sourceSheet) {
      return;
    }
    dispatch({ type: "set_template_builder_sheet", sheetId: null });
  }, [dispatch, sourceSheet, templateBuilderSheetId]);

  useEffect(() => {
    if (actionFormulaAuthoringMetadata || requestedMetadataRef.current) {
      return;
    }
    requestedMetadataRef.current = true;
    const submission = buildLoadActionFormulaAuthoringMetadataSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  }, [actionFormulaAuthoringMetadata, client]);

  useEffect(() => {
    if (!pendingSave) {
      return;
    }
    const feedback = intentFeedback.find((entry) => entry.intentId === pendingSave.requestId);
    if (!feedback || feedback.status === "pending") {
      return;
    }
    setPendingSave(null);
    if (feedback.status === "success") {
      dispatch({ type: "set_template_builder_sheet", sheetId: null });
      dispatch({ type: "set_gm_view", view: "template_library" });
    }
  }, [dispatch, intentFeedback, pendingSave]);

  const submit = (): void => {
    if (pendingSave || !validateTemplateEditorValues(values, catalogs).isValid) {
      return;
    }
    const sheetId = templateBuilderSheetId ?? makeId("template");
    const requestId = makeId("request");
    const sheet = toSheetDefinitionPayload(values, sheetId);
    const request = templateBuilderSheetId
      ? buildUpdateSheetRequest({ sheetId, sheet, requestId })
      : buildCreateSheetRequest({ sheet, requestId });
    setPendingSave({ requestId });
    client.sendProtocolRequest(
      request,
      templateBuilderSheetId ? `Update ${values.name.trim()}` : `Create ${values.name.trim()}`
    );
  };

  const exitBuilder = (): void => {
    dispatch({ type: "set_template_builder_sheet", sheetId: null });
    dispatch({ type: "set_gm_view", view: "template_library" });
  };

  return (
    <Panel
      title="Template Builder"
      actions={
        <button className="button button--secondary" type="button" onClick={exitBuilder}>
          Template Library
        </button>
      }
    >
      <TemplateEditorForm
        title={sourceSheet ? `Edit ${sourceSheet.name}` : "New Template"}
        submitLabel={sourceSheet ? "Save Template" : "Create Template"}
        values={values}
        actions={actions}
        actionOrder={actionOrder}
        proficiencies={proficiencies}
        proficiencyOrder={proficiencyOrder}
        items={items}
        itemOrder={itemOrder}
        metadata={actionFormulaAuthoringMetadata}
        pending={Boolean(pendingSave)}
        onChange={setValues}
        onSubmit={submit}
        onCancel={sourceSheet ? exitBuilder : undefined}
      />
    </Panel>
  );
}
