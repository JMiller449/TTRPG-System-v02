import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import {
  createEmptyAugmentationEditorValues,
  toAugmentationEditorValues,
  type AugmentationEditorValues
} from "@/features/augmentations/augmentationEditorValues";
import { buildAugmentationSelectorOptions } from "@/features/augmentations/augmentationSelectorOptions";
import { StandaloneEffectEditorForm } from "@/features/effects/components/StandaloneEffectEditorForm";
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
import { CatalogEditorLayout } from "@/shared/ui/CatalogEditorLayout";
import { CatalogBrowser } from "@/features/catalogs/CatalogBrowser";
import { useCatalogCreationTarget } from "@/features/catalogs/useCatalogCreationTarget";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
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
  const { beginCreation, queueCreatedEntry } = useCatalogCreationTarget({
    catalog: "effects",
    client,
    entries: standaloneEffects
  });
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

  const startNewEffect = (folderId: string | null = null): void => {
    beginCreation(folderId);
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
      queueCreatedEntry(effectId);
    }
  };

  const deleteEffect = (effectId: string): void => {
    const effect = standaloneEffects[effectId];
    const submission = buildDeleteStandaloneEffectSubmission(effectId, effect);
    if (
      !confirmDestructiveAction({
        action: "Delete",
        subject: effect?.name ?? effectId,
        consequence:
          "This permanently deletes the effect definition. Existing action and active-effect dependency checks still apply."
      })
    ) {
      return;
    }
    client.sendProtocolRequest(submission.request, submission.label);
  };

  return (
    <Panel
      title="Effect Authoring"
      subtitle="Buffs and debuffs that actions can apply — a burning blade, a shield spell, a lingering curse."
      actions={
        editingEffectId || pendingCreatedEffectId ? (
          <div className="inline-actions">
            <button
              className="button button--secondary"
              type="button"
              onClick={() => startNewEffect()}
            >
              New Effect
            </button>
            {editingEffectId ? (
              <button
                className="button button--danger"
                type="button"
                onClick={() => deleteEffect(editingEffectId)}
              >
                Delete Effect
              </button>
            ) : null}
          </div>
        ) : null
      }
    >
      <CatalogEditorLayout
        catalogLabel="Effect Catalog"
        catalog={
          <CatalogBrowser
            catalog="effects"
            client={client}
            items={orderedEffects.map((effect) => ({ id: effect.id, name: effect.name }))}
            selectedId={editingEffectId}
            entityLabel="effect"
            emptyMessage="No effects created yet."
            onCreateEntry={startNewEffect}
            onSelect={(effectId) => {
              const effect = standaloneEffects[effectId];
              if (!effect) {
                return;
              }
              beginCreation(null);
              setEditingEffectId(effect.id);
              setPendingCreatedEffectId(null);
              setValues(toAugmentationEditorValues(effect));
            }}
          />
        }
      >
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
      </CatalogEditorLayout>
    </Panel>
  );
}
