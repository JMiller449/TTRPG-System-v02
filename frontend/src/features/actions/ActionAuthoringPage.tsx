import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import { ActionEditorForm } from "@/features/actions/components/ActionEditorForm";
import { ActionAttributesEditor } from "@/features/actions/components/ActionAttributesEditor";
import type { ActionAuthoringSection } from "@/features/actions/actionAuthoringSections";
import {
  applyActionPresetTemplate,
  createEmptyActionEditorValues,
  duplicateActionEditorValues,
  getActionEditorValidationError,
  toActionEditorValues,
  type ActionEditorValues
} from "@/features/actions/actionEditorValues";
import {
  buildCreateActionSubmission,
  buildDeleteActionSubmission,
  buildLoadActionFormulaAuthoringMetadataSubmission,
  buildUpdateActionSubmission,
  selectOrderedActionDefinitions
} from "@/features/actions/actionAuthoringRequests";
import { Panel } from "@/shared/ui/Panel";
import { Field } from "@/shared/ui/Field";
import { CatalogEditorLayout } from "@/shared/ui/CatalogEditorLayout";
import { CatalogBrowser } from "@/features/catalogs/CatalogBrowser";
import { useCatalogCreationTarget } from "@/features/catalogs/useCatalogCreationTarget";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { makeId } from "@/shared/utils/id";
import { nextDuplicateName } from "@/shared/utils/duplicateName";
import type { ConditionPreset, StandaloneEffectDefinition } from "@/domain/models";
import { useFormValidationAttempt } from "@/shared/ui/useFormValidationAttempt";

export function ActionAuthoringPage({
  client,
  section,
  onSectionChange
}: {
  client: GameClient;
  section: ActionAuthoringSection;
  onSectionChange: (section: ActionAuthoringSection) => void;
}): JSX.Element {
  const {
    state: {
      serverState: {
        actions: actionRecords,
        actionOrder,
        formulas: formulaRecords,
        formulaOrder,
        standaloneEffects: standaloneEffectRecords,
        standaloneEffectOrder,
        conditionPresets,
        conditionPresetOrder,
        catalogEntries,
        proficiencies: proficiencyRecords,
        proficiencyOrder,
        attributes: attributeDefinitions
      },
      uiState: { actionFormulaAuthoringMetadata, intentFeedback }
    }
  } = useAppStore();
  const requestedMetadataRef = useRef(false);

  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [catalogSelectedActionId, setCatalogSelectedActionId] = useState<string | null>(null);
  const [guidedName, setGuidedName] = useState("");
  const [guidedBehaviorId, setGuidedBehaviorId] = useState("");
  const [values, setValues] = useState<ActionEditorValues>(createEmptyActionEditorValues);
  const [pendingSave, setPendingSave] = useState<{
    requestId: string;
    actionId: string;
    operation: "create" | "update";
  } | null>(null);
  const [saveConfirmation, setSaveConfirmation] = useState<string | null>(null);
  const validation = useFormValidationAttempt();

  const actions = useMemo(
    () => selectOrderedActionDefinitions(actionRecords, actionOrder),
    [actionOrder, actionRecords]
  );
  const { beginCreation, queueCreatedEntry } = useCatalogCreationTarget({
    catalog: "actions",
    client,
    entries: actionRecords
  });
  const proficiencies = useMemo(
    () =>
      proficiencyOrder
        .map((proficiencyId) => proficiencyRecords[proficiencyId])
        .filter((proficiency) => Boolean(proficiency)),
    [proficiencyOrder, proficiencyRecords]
  );
  const formulas = useMemo(
    () =>
      formulaOrder
        .map((formulaId) => formulaRecords[formulaId])
        .filter((formula) => Boolean(formula)),
    [formulaOrder, formulaRecords]
  );
  const standaloneEffects = useMemo(
    () =>
      standaloneEffectOrder
        .map((effectId) => standaloneEffectRecords[effectId])
        .filter(
          (effect): effect is StandaloneEffectDefinition =>
            effect?.target.root === "instance" && effect.scope === "instance"
        ),
    [standaloneEffectOrder, standaloneEffectRecords]
  );
  const conditions = useMemo(
    () =>
      conditionPresetOrder
        .map((conditionId) => conditionPresets[conditionId])
        .filter((condition): condition is ConditionPreset => Boolean(condition)),
    [conditionPresetOrder, conditionPresets]
  );
  const attributeValidationContext = {
    definitions: attributeDefinitions,
    proficiencies: proficiencyRecords
  };
  const validationError = getActionEditorValidationError(values, attributeValidationContext);
  const startNewAction = (folderId: string | null = null): void => {
    if (pendingSave) {
      return;
    }
    beginCreation(folderId);
    setEditingActionId(null);
    setValues(createEmptyActionEditorValues());
    setSaveConfirmation(null);
    validation.reset();
  };
  const startRawAction = (folderId: string | null = null): void => {
    startNewAction(folderId);
    setCatalogSelectedActionId(null);
    onSectionChange("catalog");
  };
  const openAction = (actionId: string): void => {
    if (pendingSave) {
      return;
    }
    const action = actionRecords[actionId];
    if (!action) {
      return;
    }
    beginCreation(null);
    setEditingActionId(action.id);
    setValues(toActionEditorValues(action));
    setSaveConfirmation(null);
    validation.reset();
  };
  const duplicateAction = (actionId: string): void => {
    if (pendingSave) {
      return;
    }
    const action = actionRecords[actionId];
    if (!action) {
      return;
    }
    beginCreation(catalogEntries[`actions:${action.id}`]?.folder_id ?? null);
    setEditingActionId(null);
    setValues({
      ...duplicateActionEditorValues(action, () => makeId("action_attribute")),
      name: nextDuplicateName(
        action.name,
        actions.map((candidate) => candidate.name)
      )
    });
    setSaveConfirmation(null);
    validation.reset();
    setCatalogSelectedActionId(null);
    onSectionChange("catalog");
  };

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
    if (feedback.status === "error") {
      setPendingSave(null);
      return;
    }
    const savedAction = actionRecords[pendingSave.actionId];
    if (!savedAction) {
      return;
    }
    setEditingActionId(savedAction.id);
    setValues(toActionEditorValues(savedAction));
    setSaveConfirmation(
      pendingSave.operation === "create"
        ? `Action “${savedAction.name}” created.`
        : `Action “${savedAction.name}” saved.`
    );
    setPendingSave(null);
  }, [actionRecords, intentFeedback, pendingSave]);

  const onSubmit = (): void => {
    if (pendingSave || !validation.validate(validationError === null)) {
      return;
    }

    const actionId = editingActionId ?? makeId("action");
    const requestId = makeId("request");
    const submission = editingActionId
      ? buildUpdateActionSubmission(
          actionRecords[editingActionId],
          values,
          attributeValidationContext
        )
      : buildCreateActionSubmission(values, actionId, attributeValidationContext);
    if (!submission) {
      return;
    }

    setSaveConfirmation(null);
    setPendingSave({
      requestId,
      actionId,
      operation: editingActionId ? "update" : "create"
    });
    client.sendProtocolRequest({ ...submission.request, request_id: requestId }, submission.label);
    if (!editingActionId) {
      queueCreatedEntry(actionId);
    }
  };

  const deleteAction = (actionId: string): void => {
    const action = actionRecords[actionId];
    if (
      !confirmDestructiveAction({
        action: "Delete",
        subject: action?.name ?? actionId,
        consequence:
          "This permanently deletes the action definition. Existing dependency checks still apply."
      })
    ) {
      return;
    }
    const submission = buildDeleteActionSubmission(actionId, action);
    client.sendProtocolRequest(submission.request, submission.label);
    if (editingActionId === actionId) {
      startNewAction();
    }
    if (catalogSelectedActionId === actionId) {
      setCatalogSelectedActionId(null);
    }
  };

  const applyPreset = (
    preset: Parameters<typeof applyActionPresetTemplate>[1],
    name?: string
  ): void => {
    if (pendingSave) {
      return;
    }
    setEditingActionId(null);
    beginCreation(null);
    const nextValues = applyActionPresetTemplate(
      createEmptyActionEditorValues(),
      preset,
      attributeDefinitions,
      () => makeId("action_attribute")
    );
    setValues({ ...nextValues, name: name?.trim() || nextValues.name });
    setSaveConfirmation(null);
    validation.reset();
    setCatalogSelectedActionId(null);
    onSectionChange("catalog");
  };

  const actionEditor = (
    <div className="stack action-authoring-editor">
      {saveConfirmation ? (
        <p className="action-authoring-feedback" role="status">
          {saveConfirmation}
        </p>
      ) : null}
      <ActionEditorForm
        editingActionId={editingActionId}
        values={values}
        onChange={(nextValues) => {
          setValues(nextValues);
          setSaveConfirmation(null);
        }}
        onSubmit={onSubmit}
        onCancel={() => {
          startNewAction();
          setCatalogSelectedActionId(null);
          onSectionChange("catalog");
        }}
        metadata={actionFormulaAuthoringMetadata}
        proficiencies={proficiencies}
        formulas={formulas}
        standaloneEffects={standaloneEffects}
        conditions={conditions}
        validationError={validationError}
        validationAttempted={validation.attempted}
        pending={Boolean(pendingSave)}
        onFocusedStepChange={() => undefined}
        attributesEditor={
          <ActionAttributesEditor
            values={values}
            definitions={attributeDefinitions}
            proficiencies={proficiencyRecords}
            metadata={actionFormulaAuthoringMetadata}
            onChange={(nextValues) => {
              setValues(nextValues);
              setSaveConfirmation(null);
            }}
          />
        }
      />
    </div>
  );

  if (section === "catalog") {
    return (
      <Panel
        variant="workspace"
        className="action-authoring-panel"
        title="Action Catalog"
        subtitle="Browse authored Actions and edit the selected definition in the full builder."
        actions={
          <div className="inline-actions">
            <button className="button button--primary" onClick={() => startRawAction()}>
              New Action
            </button>
            {editingActionId ? (
              <>
                <button
                  className="button button--secondary"
                  onClick={() => duplicateAction(editingActionId)}
                  disabled={Boolean(pendingSave)}
                >
                  Duplicate
                </button>
                <button
                  className="button button--danger"
                  onClick={() => deleteAction(editingActionId)}
                  disabled={Boolean(pendingSave)}
                >
                  Delete Action
                </button>
              </>
            ) : null}
          </div>
        }
      >
        <CatalogEditorLayout
          catalogLabel="Authored Actions"
          catalog={
            <CatalogBrowser
              catalog="actions"
              client={client}
              items={actions.map((action) => ({ id: action.id, name: action.name }))}
              selectedId={catalogSelectedActionId}
              entityLabel="action"
              emptyMessage="No actions created yet."
              onCreateEntry={startRawAction}
              onSelect={(actionId) => {
                setCatalogSelectedActionId(actionId);
                openAction(actionId);
              }}
            />
          }
          editorClassName="authoring-workspace__editor--vertical"
        >
          {actionEditor}
        </CatalogEditorLayout>
      </Panel>
    );
  }

  if (section === "guided") {
    const behaviors = actionFormulaAuthoringMetadata?.action_preset_templates ?? [];
    const selectedBehavior = behaviors.find((preset) => preset.id === guidedBehaviorId);
    const categories = Array.from(new Set(behaviors.map((preset) => preset.category)));
    return (
      <Panel
        variant="workspace"
        className="action-authoring-panel"
        title="Guided Action Creation"
        subtitle="Answer two basic questions, then finish one ordinary Action in the Catalog editor."
      >
        <section className="stack action-guided-builder" aria-label="Guided Action builder">
          <div>
            <h3>What should this Action do?</h3>
            <p className="muted">
              This creates one editable Action draft. It does not create, select, or modify an Item.
            </p>
          </div>
          <Field label="Action name" required>
            <input
              value={guidedName}
              placeholder="e.g. Shield Bash"
              onChange={(event) => setGuidedName(event.target.value)}
            />
          </Field>
          <Field label="Common behavior" required>
            <select
              value={guidedBehaviorId}
              onChange={(event) => setGuidedBehaviorId(event.target.value)}
            >
              <option value="">Choose what the Action does</option>
              {categories.map((category) => (
                <optgroup key={category} label={category.replace(/_/g, " ")}>
                  {behaviors
                    .filter((preset) => preset.category === category)
                    .map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </Field>
          {selectedBehavior ? <p className="muted">{selectedBehavior.description}</p> : null}
          <div className="inline-actions">
            <button
              type="button"
              className="button button--primary"
              disabled={!guidedName.trim() || !selectedBehavior}
              onClick={() => {
                if (selectedBehavior) {
                  applyPreset(selectedBehavior, guidedName);
                }
              }}
            >
              Continue in Catalog
            </button>
          </div>
        </section>
      </Panel>
    );
  }

  return actionEditor;
}
