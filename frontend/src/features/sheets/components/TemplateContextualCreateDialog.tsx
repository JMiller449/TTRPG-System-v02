import { useMemo, useState } from "react";
import type { ServerState } from "@/app/state/types";
import type { ActionFormulaAuthoringMetadata, AugmentationTargetMetadata } from "@/domain/ipc";
import type { ConditionPreset, StandaloneEffectDefinition } from "@/domain/models";
import { buildCreateActionSubmission } from "@/features/actions/actionAuthoringRequests";
import { ActionEditorForm } from "@/features/actions/components/ActionEditorForm";
import { ActionAttributesEditor } from "@/features/actions/components/ActionAttributesEditor";
import { ActionPresetPicker } from "@/features/actions/components/ActionPresetPicker";
import {
  applyActionPresetTemplate,
  createEmptyActionEditorValues,
  getActionEditorValidationError,
  type ActionEditorValues
} from "@/features/actions/actionEditorValues";
import {
  createEmptyAugmentationEditorValues,
  hasValidAugmentationEditorValues,
  isKnownAugmentationEditorTarget,
  toAugmentationEditorValues,
  toItemAugmentationTemplatePayload,
  type AugmentationEditorValues
} from "@/features/augmentations/augmentationEditorValues";
import { buildAugmentationSelectorOptions } from "@/features/augmentations/augmentationSelectorOptions";
import { ItemAugmentationTemplatePanel } from "@/features/augmentations/components/ItemAugmentationTemplatePanel";
import { AttributeEditorForm } from "@/features/attributes/components/AttributeEditorForm";
import { emptyAttributeDraft, attributePayloadFromDraft } from "@/features/attributes/attributeEditorValues";
import { ItemEditorForm } from "@/features/items/components/ItemEditorForm";
import { ItemAttributesEditor } from "@/features/items/components/ItemAttributesEditor";
import { buildCreateItemSubmission } from "@/features/items/itemMakerRequests";
import { createEmptyItemValues, type ItemEditorValues } from "@/features/items/itemEditorValues";
import { ProficiencyEditorForm } from "@/features/proficiencies/components/ProficiencyEditorForm";
import { buildCreateProficiencySubmission } from "@/features/proficiencies/proficiencyAuthoringRequests";
import {
  createEmptyProficiencyEditorValues,
  deriveProficiencyId,
  type ProficiencyEditorValues
} from "@/features/proficiencies/proficiencyEditorValues";
import type { TemplateContextualEntityKind } from "@/features/sheets/templateContextualAuthoring";
import type { ProtocolApplicationRequest } from "@/infrastructure/ws/protocol";
import { buildCreateAttributeRequest } from "@/infrastructure/ws/requestBuilders";
import { ModalDialog } from "@/shared/ui/ModalDialog";
import { makeId } from "@/shared/utils/id";

export interface TemplateContextualCreateSubmission {
  kind: TemplateContextualEntityKind;
  entityId: string;
  requestId: string;
  request: ProtocolApplicationRequest;
  label: string;
}

const DIALOG_COPY: Record<TemplateContextualEntityKind, { title: string; description: string }> = {
  attribute: {
    title: "Create and attach Attribute",
    description: "Create a sheet-compatible Attribute. It attaches after the backend confirms it."
  },
  proficiency: {
    title: "Create and attach Proficiency",
    description: "Create a proficiency definition without leaving the current template draft."
  },
  item: {
    title: "Create and attach Item",
    description: "Create a complete item, then add one unequipped copy to starting inventory."
  },
  action: {
    title: "Create and attach Action",
    description: "Create an authored action and attach it after authoritative reconciliation."
  }
};

function requestWithId(
  request: ProtocolApplicationRequest,
  requestId: string
): ProtocolApplicationRequest {
  return { ...request, request_id: requestId } as ProtocolApplicationRequest;
}

export function TemplateContextualCreateDialog({
  kind,
  pending,
  serverState,
  formulaMetadata,
  augmentationTargetMetadata,
  onSubmit,
  onClose
}: {
  kind: TemplateContextualEntityKind;
  pending: boolean;
  serverState: ServerState;
  formulaMetadata: ActionFormulaAuthoringMetadata | null;
  augmentationTargetMetadata: AugmentationTargetMetadata | null;
  onSubmit: (submission: TemplateContextualCreateSubmission) => void;
  onClose: () => void;
}): JSX.Element {
  const [attributeDraft, setAttributeDraft] = useState(() => emptyAttributeDraft());
  const [proficiencyValues, setProficiencyValues] = useState<ProficiencyEditorValues>(
    createEmptyProficiencyEditorValues
  );
  const [itemValues, setItemValues] = useState<ItemEditorValues>(createEmptyItemValues);
  const [actionValues, setActionValues] = useState<ActionEditorValues>(
    createEmptyActionEditorValues
  );
  const [editingAugmentationId, setEditingAugmentationId] = useState<string | null>(null);
  const [augmentationValues, setAugmentationValues] = useState<AugmentationEditorValues>(
    createEmptyAugmentationEditorValues
  );
  const copy = DIALOG_COPY[kind];

  const actions = useMemo(
    () => serverState.actionOrder.map((id) => serverState.actions[id]).filter(Boolean),
    [serverState.actionOrder, serverState.actions]
  );
  const formulas = useMemo(
    () => serverState.formulaOrder.map((id) => serverState.formulas[id]).filter(Boolean),
    [serverState.formulaOrder, serverState.formulas]
  );
  const proficiencies = useMemo(
    () => serverState.proficiencyOrder.map((id) => serverState.proficiencies[id]).filter(Boolean),
    [serverState.proficiencies, serverState.proficiencyOrder]
  );
  const standaloneEffects = useMemo(
    () =>
      serverState.standaloneEffectOrder
        .map((id) => serverState.standaloneEffects[id])
        .filter(
          (effect): effect is StandaloneEffectDefinition =>
            effect?.target.root === "instance" && effect.scope === "instance"
        ),
    [serverState.standaloneEffectOrder, serverState.standaloneEffects]
  );
  const conditions = useMemo(
    () =>
      serverState.conditionPresetOrder
        .map((id) => serverState.conditionPresets[id])
        .filter((condition): condition is ConditionPreset => Boolean(condition)),
    [serverState.conditionPresetOrder, serverState.conditionPresets]
  );
  const selectorOptions = useMemo(
    () =>
      buildAugmentationSelectorOptions({
        actionRecords: serverState.actions,
        actionOrder: serverState.actionOrder,
        formulaRecords: serverState.formulas,
        formulaOrder: serverState.formulaOrder
      }),
    [serverState.actionOrder, serverState.actions, serverState.formulaOrder, serverState.formulas]
  );
  const targetOptions =
    augmentationTargetMetadata?.context === "item_template"
      ? augmentationTargetMetadata.targets
      : [];
  const actionValidationError = getActionEditorValidationError(actionValues, {
    definitions: serverState.attributes,
    proficiencies: serverState.proficiencies
  });
  const proficiencyId = deriveProficiencyId(
    proficiencyValues.name,
    Object.keys(serverState.proficiencies)
  );
  const proficiencyValidationError = null;

  const submit = (
    entityKind: TemplateContextualEntityKind,
    entityId: string,
    request: ProtocolApplicationRequest,
    label: string
  ): void => {
    if (pending) {
      return;
    }
    const requestId = makeId("request");
    onSubmit({
      kind: entityKind,
      entityId,
      requestId,
      request: requestWithId(request, requestId),
      label
    });
  };

  const submitAttribute = (): void => {
    const attributeId = makeId("attribute");
    const attribute = attributePayloadFromDraft(attributeDraft, attributeId);
    if (!attribute) {
      return;
    }
    submit("attribute", attributeId, buildCreateAttributeRequest({ attribute }), `Create Attribute: ${attribute.name}`);
  };

  const submitProficiency = (): void => {
    if (proficiencyValidationError) {
      return;
    }
    const submission = buildCreateProficiencySubmission(proficiencyValues, proficiencyId);
    if (!submission) {
      return;
    }
    submit("proficiency", proficiencyId, submission.request, submission.label);
  };

  const submitItem = (): void => {
    const itemId = makeId("item");
    const submission = buildCreateItemSubmission(itemValues, itemId, {
      definitions: serverState.attributes,
      proficiencies: serverState.proficiencies
    });
    if (!submission) {
      return;
    }
    submit("item", itemId, submission.request, submission.label);
  };

  const submitAction = (): void => {
    const actionId = makeId("action");
    const submission = buildCreateActionSubmission(actionValues, actionId, {
      definitions: serverState.attributes,
      proficiencies: serverState.proficiencies
    });
    if (!submission) {
      return;
    }
    submit("action", actionId, submission.request, submission.label);
  };

  const resetAugmentation = (): void => {
    setEditingAugmentationId(null);
    setAugmentationValues(createEmptyAugmentationEditorValues());
  };

  const submitAugmentation = (): void => {
    if (
      !hasValidAugmentationEditorValues(augmentationValues) ||
      !isKnownAugmentationEditorTarget(augmentationValues, targetOptions)
    ) {
      return;
    }
    const augmentation = toItemAugmentationTemplatePayload({
      values: augmentationValues,
      augmentationId: editingAugmentationId ?? makeId("augmentation"),
      itemId: "draft-item",
      itemName: itemValues.name
    });
    setItemValues((current) => ({
      ...current,
      augmentationTemplates: editingAugmentationId
        ? current.augmentationTemplates.map((template) =>
            template.id === editingAugmentationId ? augmentation : template
          )
        : [...current.augmentationTemplates, augmentation]
    }));
    resetAugmentation();
  };

  return (
    <ModalDialog
      title={copy.title}
      description={copy.description}
      pending={pending}
      size={kind === "attribute" || kind === "proficiency" ? "compact" : "large"}
      onClose={onClose}
    >
      {kind === "attribute" ? (
        <AttributeEditorForm
          editingId={null}
          draft={attributeDraft}
          metadata={formulaMetadata}
          pending={pending}
          requiredSubjectType="sheet"
          onChange={setAttributeDraft}
          onSubmit={submitAttribute}
        />
      ) : null}
      {kind === "proficiency" ? (
        <ProficiencyEditorForm
          editingProficiencyId={null}
          values={proficiencyValues}
          pending={pending}
          validationError={proficiencyValidationError}
          onChange={setProficiencyValues}
          onSubmit={submitProficiency}
          onCancel={onClose}
        />
      ) : null}
      {kind === "item" ? (
        <ItemEditorForm
          editingItemId={null}
          values={itemValues}
          pending={pending}
          onChange={setItemValues}
          actions={actions}
          attributeDefinitions={serverState.attributes}
          proficiencies={serverState.proficiencies}
          attributesEditor={
            <ItemAttributesEditor
              values={itemValues}
              definitions={serverState.attributes}
              proficiencies={serverState.proficiencies}
              metadata={formulaMetadata}
              onChange={setItemValues}
            />
          }
          effectEditor={
            <ItemAugmentationTemplatePanel
              itemName={itemValues.name.trim() || "New equippable item"}
              editingAugmentationId={editingAugmentationId}
              templates={itemValues.augmentationTemplates}
              targetOptions={targetOptions}
              selectorOptions={selectorOptions}
              formulaMetadata={formulaMetadata}
              values={augmentationValues}
              onChange={setAugmentationValues}
              onSubmit={submitAugmentation}
              onCancel={resetAugmentation}
              onEdit={(augmentation) => {
                setEditingAugmentationId(augmentation.id);
                setAugmentationValues(toAugmentationEditorValues(augmentation));
              }}
              onRemove={(augmentationId) => {
                setItemValues((current) => ({
                  ...current,
                  augmentationTemplates: current.augmentationTemplates.filter(
                    (template) => template.id !== augmentationId
                  )
                }));
                if (editingAugmentationId === augmentationId) {
                  resetAugmentation();
                }
              }}
            />
          }
          onSubmit={submitItem}
          onCancel={onClose}
        />
      ) : null}
      {kind === "action" ? (
        <div className="stack">
          <ActionPresetPicker
            presets={formulaMetadata?.action_preset_templates ?? []}
            onApply={(preset) =>
              setActionValues(
                applyActionPresetTemplate(
                  createEmptyActionEditorValues(),
                  preset,
                  serverState.attributes,
                  () => makeId("action_attribute")
                )
              )
            }
          />
          <ActionEditorForm
            editingActionId={null}
            values={actionValues}
            pending={pending}
            onChange={setActionValues}
            onSubmit={submitAction}
            onCancel={onClose}
            metadata={formulaMetadata}
            proficiencies={proficiencies}
            formulas={formulas}
            standaloneEffects={standaloneEffects}
            conditions={conditions}
            validationError={actionValidationError}
            attributesEditor={
              <ActionAttributesEditor
                values={actionValues}
                definitions={serverState.attributes}
                proficiencies={serverState.proficiencies}
                metadata={formulaMetadata}
                onChange={setActionValues}
              />
            }
          />
        </div>
      ) : null}
    </ModalDialog>
  );
}
