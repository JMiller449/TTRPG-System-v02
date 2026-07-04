import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { buildLoadActionFormulaAuthoringMetadataSubmission } from "@/features/actions/actionAuthoringRequests";
import { buildLoadItemAugmentationTargetMetadataSubmission } from "@/features/augmentations/augmentationRequests";
import { TemplateContextualCreateDialog } from "@/features/sheets/components/TemplateContextualCreateDialog";
import { TemplateEditorForm } from "@/features/sheets/TemplateEditorForm";
import {
  attachContextualRecord,
  contextualRecord,
  resolveTemplateContextualCreate,
  type PendingTemplateContextualCreate,
  type TemplateContextualEntityKind
} from "@/features/sheets/templateContextualAuthoring";
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
  const { serverState } = state;
  const { actions, actionOrder, proficiencies, proficiencyOrder, items, itemOrder, attributes, sheets } =
    serverState;
  const {
    templateBuilderSheetId,
    actionFormulaAuthoringMetadata,
    augmentationTargetMetadata,
    intentFeedback
  } = state.uiState;
  const sourceSheet = templateBuilderSheetId ? sheets[templateBuilderSheetId] : undefined;
  const formulaDefaults = useMemo(
    () => actionFormulaAuthoringMetadata?.sheet_formula_stat_defaults ?? [],
    [actionFormulaAuthoringMetadata]
  );
  const formulaDefaultsReady = formulaDefaults.length > 0;
  const [values, setValues] = useState<TemplateEditorValues>(() =>
    sourceSheet
      ? toTemplateEditorValues(sourceSheet)
      : createEmptyTemplateEditorValues("player", attributes, formulaDefaults)
  );
  const [pendingSave, setPendingSave] = useState<PendingTemplateSave | null>(null);
  const [contextualKind, setContextualKind] = useState<TemplateContextualEntityKind | null>(null);
  const [pendingContextualCreate, setPendingContextualCreate] =
    useState<PendingTemplateContextualCreate | null>(null);
  const loadedDraftSourceRef = useRef<string | undefined>(undefined);
  const requestedMetadataRef = useRef(false);
  const requestedItemMetadataRef = useRef(false);
  const catalogs = useMemo(
    () => ({ actions, proficiencies, items, attributes }),
    [actions, attributes, items, proficiencies]
  );

  useEffect(() => {
    const draftSource =
      templateBuilderSheetId ?? `new:${formulaDefaultsReady ? "ready" : "waiting"}`;
    if (loadedDraftSourceRef.current === draftSource) {
      return;
    }
    loadedDraftSourceRef.current = draftSource;
    setValues(
      templateBuilderSheetId && sheets[templateBuilderSheetId]
        ? toTemplateEditorValues(sheets[templateBuilderSheetId])
        : createEmptyTemplateEditorValues("player", attributes, formulaDefaults)
    );
  }, [attributes, formulaDefaults, formulaDefaultsReady, sheets, templateBuilderSheetId]);

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
    if (contextualKind !== "item" || augmentationTargetMetadata?.context === "item_template") {
      return;
    }
    if (requestedItemMetadataRef.current) {
      return;
    }
    requestedItemMetadataRef.current = true;
    const submission = buildLoadItemAugmentationTargetMetadataSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  }, [augmentationTargetMetadata?.context, client, contextualKind]);

  useEffect(() => {
    if (!pendingContextualCreate) {
      return;
    }
    const resolution = resolveTemplateContextualCreate(
      pendingContextualCreate,
      intentFeedback,
      serverState
    );
    if (resolution === "pending") {
      return;
    }
    if (resolution === "error") {
      setPendingContextualCreate(null);
      return;
    }
    const record = contextualRecord(
      serverState,
      pendingContextualCreate.kind,
      pendingContextualCreate.entityId
    );
    if (!record) {
      return;
    }
    setValues((current) =>
      attachContextualRecord(
        current,
        pendingContextualCreate.kind,
        pendingContextualCreate.entityId,
        record,
        makeId
      )
    );
    setPendingContextualCreate(null);
    setContextualKind(null);
  }, [intentFeedback, pendingContextualCreate, serverState]);

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

  const closeContextualDialog = useCallback((): void => {
    if (!pendingContextualCreate) {
      setContextualKind(null);
    }
  }, [pendingContextualCreate]);

  const openContextualDialog = useCallback(
    (kind: TemplateContextualEntityKind): void => {
      if (kind === "item" && augmentationTargetMetadata?.context !== "item_template") {
        requestedItemMetadataRef.current = false;
      }
      setContextualKind(kind);
    },
    [augmentationTargetMetadata?.context]
  );

  return (
    <Panel
      title="Template Builder"
      actions={
        <button className="button button--secondary" type="button" onClick={exitBuilder}>
          Template Library
        </button>
      }
    >
      {!sourceSheet && !formulaDefaultsReady ? (
        <p className="muted">
          {actionFormulaAuthoringMetadata
            ? "Backend template defaults are unavailable."
            : "Loading backend template defaults…"}
        </p>
      ) : (
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
          attributes={attributes}
          metadata={actionFormulaAuthoringMetadata}
          pending={Boolean(pendingSave)}
          onCreateReference={openContextualDialog}
          onChange={setValues}
          onSubmit={submit}
          onCancel={sourceSheet ? exitBuilder : undefined}
        />
      )}
      {contextualKind ? (
        <TemplateContextualCreateDialog
          key={contextualKind}
          kind={contextualKind}
          pending={Boolean(pendingContextualCreate)}
          serverState={serverState}
          formulaMetadata={actionFormulaAuthoringMetadata}
          augmentationTargetMetadata={augmentationTargetMetadata}
          onSubmit={(submission) => {
            setPendingContextualCreate({
              kind: submission.kind,
              entityId: submission.entityId,
              requestId: submission.requestId
            });
            client.sendProtocolRequest(submission.request, submission.label);
          }}
          onClose={closeContextualDialog}
        />
      ) : null}
    </Panel>
  );
}
