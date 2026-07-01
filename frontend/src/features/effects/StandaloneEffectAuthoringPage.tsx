import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import {
  createEmptyAugmentationEditorValues,
  toAugmentationEditorValues,
  type AugmentationEditorValues
} from "@/features/augmentations/augmentationEditorValues";
import { buildAugmentationSelectorOptions } from "@/features/augmentations/augmentationSelectorOptions";
import { StandaloneEffectEditorForm } from "@/features/effects/components/StandaloneEffectEditorForm";
import { StandaloneEffectList } from "@/features/effects/components/StandaloneEffectList";
import {
  buildCreateStandaloneEffectSubmission,
  buildDeleteStandaloneEffectSubmission,
  buildLoadStandaloneEffectFormulaMetadataSubmission,
  buildLoadStandaloneEffectTargetMetadataSubmission,
  buildUpdateStandaloneEffectSubmission,
  selectOrderedStandaloneEffects
} from "@/features/effects/standaloneEffectAuthoringRequests";
import type { GameClient } from "@/hooks/useGameClient";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

export function StandaloneEffectAuthoringPage({ client }: { client: GameClient }): JSX.Element {
  const {
    state: {
      serverState: {
        standaloneEffects,
        standaloneEffectOrder,
        actions,
        actionOrder,
        formulas,
        formulaOrder
      },
      uiState: { actionFormulaAuthoringMetadata, augmentationTargetMetadata }
    }
  } = useAppStore();
  const requestedFormulaMetadata = useRef(false);
  const [editingEffectId, setEditingEffectId] = useState<string | null>(null);
  const [pendingCreatedEffectId, setPendingCreatedEffectId] = useState<string | null>(null);
  const [values, setValues] = useState<AugmentationEditorValues>(
    createEmptyAugmentationEditorValues
  );

  const orderedEffects = useMemo(
    () => selectOrderedStandaloneEffects(standaloneEffects, standaloneEffectOrder),
    [standaloneEffectOrder, standaloneEffects]
  );
  const selectorOptions = useMemo(
    () =>
      buildAugmentationSelectorOptions({
        actionRecords: actions,
        actionOrder,
        formulaRecords: formulas,
        formulaOrder
      }),
    [actionOrder, actions, formulaOrder, formulas]
  );
  const targetOptions = useMemo(
    () =>
      augmentationTargetMetadata?.context === "runtime"
        ? augmentationTargetMetadata.targets.filter((target) => target.root === "instance")
        : [],
    [augmentationTargetMetadata]
  );

  useEffect(() => {
    if (augmentationTargetMetadata?.context === "runtime") {
      return;
    }
    const submission = buildLoadStandaloneEffectTargetMetadataSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  }, [augmentationTargetMetadata?.context, client]);

  useEffect(() => {
    if (actionFormulaAuthoringMetadata || requestedFormulaMetadata.current) {
      return;
    }
    requestedFormulaMetadata.current = true;
    const submission = buildLoadStandaloneEffectFormulaMetadataSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  }, [actionFormulaAuthoringMetadata, client]);

  useEffect(() => {
    if (!pendingCreatedEffectId) {
      return;
    }
    const createdEffect = standaloneEffects[pendingCreatedEffectId];
    if (!createdEffect) {
      return;
    }
    setEditingEffectId(createdEffect.id);
    setValues(toAugmentationEditorValues(createdEffect));
    setPendingCreatedEffectId(null);
  }, [pendingCreatedEffectId, standaloneEffects]);

  useEffect(() => {
    if (!editingEffectId || standaloneEffects[editingEffectId]) {
      return;
    }
    setEditingEffectId(null);
    setValues(createEmptyAugmentationEditorValues());
  }, [editingEffectId, standaloneEffects]);

  const startNewEffect = (): void => {
    setEditingEffectId(null);
    setPendingCreatedEffectId(null);
    setValues(createEmptyAugmentationEditorValues());
  };

  const submitEffect = (): void => {
    const effectId = editingEffectId ?? makeId("standalone_effect");
    const submission = editingEffectId
      ? buildUpdateStandaloneEffectSubmission(standaloneEffects[editingEffectId], values)
      : buildCreateStandaloneEffectSubmission(values, effectId);
    if (!submission) {
      return;
    }
    client.sendProtocolRequest(submission.request, submission.label);
    if (!editingEffectId) {
      setPendingCreatedEffectId(effectId);
    }
  };

  const deleteEffect = (effectId: string): void => {
    const submission = buildDeleteStandaloneEffectSubmission(effectId, standaloneEffects[effectId]);
    if (!submission.confirmation || !window.confirm(submission.confirmation)) {
      return;
    }
    client.sendProtocolRequest(submission.request, submission.label);
  };

  return (
    <Panel
      title="Effect Authoring"
      actions={
        editingEffectId || pendingCreatedEffectId ? (
          <button className="button button--secondary" type="button" onClick={startNewEffect}>
            New Effect
          </button>
        ) : null
      }
    >
      <div className="stack">
        <StandaloneEffectEditorForm
          editingEffectId={editingEffectId}
          values={values}
          targetOptions={targetOptions}
          selectorOptions={selectorOptions}
          formulaMetadata={actionFormulaAuthoringMetadata}
          onChange={setValues}
          onSubmit={submitEffect}
          onCancel={startNewEffect}
        />
        <StandaloneEffectList
          effects={orderedEffects}
          onEdit={(effect) => {
            setEditingEffectId(effect.id);
            setPendingCreatedEffectId(null);
            setValues(toAugmentationEditorValues(effect));
          }}
          onDelete={deleteEffect}
        />
      </div>
    </Panel>
  );
}
