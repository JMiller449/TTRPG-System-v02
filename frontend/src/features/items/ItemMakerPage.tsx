import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { buildLoadActionFormulaAuthoringMetadataSubmission } from "@/features/actions/actionAuthoringRequests";
import type { GameClient } from "@/hooks/useGameClient";
import { ItemEditorForm } from "@/features/items/components/ItemEditorForm";
import { ItemAttributesEditor } from "@/features/items/components/ItemAttributesEditor";
import { CatalogBrowser } from "@/features/catalogs/CatalogBrowser";
import { useCatalogCreationTarget } from "@/features/catalogs/useCatalogCreationTarget";
import {
  createEmptyItemValues,
  duplicateItemEditorValues,
  getItemEditorValidationError,
  toItemEditorValues,
  type ItemEditorValues
} from "@/features/items/itemEditorValues";
import {
  buildCreateItemSubmission,
  buildDeleteItemSubmission,
  buildUpdateItemSubmission,
  selectOrderedItemDefinitions
} from "@/features/items/itemMakerRequests";
import { buildReviewPlayerItemRequest } from "@/infrastructure/ws/requestBuilders";
import { Panel } from "@/shared/ui/Panel";
import { CatalogEditorLayout } from "@/shared/ui/CatalogEditorLayout";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { makeId } from "@/shared/utils/id";
import { nextDuplicateName } from "@/shared/utils/duplicateName";
import { useFormValidationAttempt } from "@/shared/ui/useFormValidationAttempt";
import { EffectReferenceEditor } from "@/features/effects/components/EffectReferenceEditor";
import { WeaponBuilderWizard } from "@/features/actions/components/WeaponActionWizard";
import type { ItemAuthoringSection } from "@/features/items/itemAuthoringSections";

export function ItemMakerPage({
  client,
  section = "catalog",
  onSectionChange = () => undefined
}: {
  client: GameClient;
  section?: ItemAuthoringSection;
  onSectionChange?: (section: ItemAuthoringSection) => void;
}): JSX.Element {
  const {
    state: {
      serverState: {
        items: itemRecords,
        itemOrder,
        catalogEntries,
        actions: actionRecords,
        actionOrder,
        attributes: attributeDefinitions,
        proficiencies: proficiencyRecords,
        proficiencyOrder,
        tags: tagDefinitions,
        standaloneEffects
      },
      uiState: { actionFormulaAuthoringMetadata, intentFeedback }
    },
    dispatch
  } = useAppStore();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [catalogSelectedItemId, setCatalogSelectedItemId] = useState<string | null>(null);
  const [draftItemId, setDraftItemId] = useState(() => makeId("item"));
  const [submittedCreateId, setSubmittedCreateId] = useState<string | null>(null);
  const [values, setValues] = useState<ItemEditorValues>(createEmptyItemValues);
  const requestedFormulaMetadataRef = useRef(false);
  const validation = useFormValidationAttempt();

  const items = useMemo(
    () =>
      selectOrderedItemDefinitions(itemRecords, itemOrder).filter(
        (item) => item.approval_status !== "pending"
      ),
    [itemOrder, itemRecords]
  );
  const pendingPlayerItems = useMemo(
    () =>
      selectOrderedItemDefinitions(itemRecords, itemOrder).filter(
        (item) => item.approval_status === "pending"
      ),
    [itemOrder, itemRecords]
  );
  const actions = useMemo(
    () => actionOrder.map((id) => actionRecords[id]).filter(Boolean),
    [actionOrder, actionRecords]
  );
  const proficiencies = useMemo(
    () => proficiencyOrder.map((id) => proficiencyRecords[id]).filter(Boolean),
    [proficiencyOrder, proficiencyRecords]
  );
  const { beginCreation, queueCreatedEntry } = useCatalogCreationTarget({
    catalog: "items",
    client,
    entries: itemRecords
  });
  useEffect(() => {
    if (actionFormulaAuthoringMetadata || requestedFormulaMetadataRef.current) {
      return;
    }
    requestedFormulaMetadataRef.current = true;
    const submission = buildLoadActionFormulaAuthoringMetadataSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  }, [actionFormulaAuthoringMetadata, client]);

  const startNewItem = (folderId: string | null = null): void => {
    validation.reset();
    beginCreation(folderId);
    setEditingItemId(null);
    setDraftItemId(makeId("item"));
    setSubmittedCreateId(null);
    setValues(createEmptyItemValues());
  };

  const showStart = (): void => {
    validation.reset();
    beginCreation(null);
    setEditingItemId(null);
    setCatalogSelectedItemId(null);
    setDraftItemId(makeId("item"));
    setSubmittedCreateId(null);
    setValues(createEmptyItemValues());
  };

  useEffect(() => {
    if (submittedCreateId && itemRecords[submittedCreateId]) {
      setEditingItemId(null);
      setDraftItemId(makeId("item"));
      setSubmittedCreateId(null);
      setValues(createEmptyItemValues());
    }
  }, [itemRecords, submittedCreateId]);

  const onSubmit = (): void => {
    const validationContext = {
      definitions: attributeDefinitions,
      proficiencies: proficiencyRecords
    };
    if (!validation.validate(getItemEditorValidationError(values, validationContext) === null)) {
      return;
    }
    const submission = editingItemId
      ? buildUpdateItemSubmission(itemRecords[editingItemId], values, validationContext)
      : buildCreateItemSubmission(values, draftItemId, validationContext);
    if (!submission) {
      return;
    }

    client.sendProtocolRequest(submission.request, submission.label);
    if (!editingItemId) {
      setSubmittedCreateId(draftItemId);
      queueCreatedEntry(draftItemId);
    }
  };

  const deleteItem = (itemId: string): void => {
    const item = itemRecords[itemId];
    if (
      !confirmDestructiveAction({
        action: "Delete",
        subject: item?.name ?? itemId,
        consequence:
          "This permanently deletes the item definition and every copy attached to character templates or spawned characters, including equipped copies. Contents of deleted containers move to root inventory."
      })
    ) {
      return;
    }
    const submission = buildDeleteItemSubmission(itemId, item);
    client.sendProtocolRequest(submission.request, submission.label);
    if (editingItemId === itemId) {
      showStart();
    }
    if (catalogSelectedItemId === itemId) {
      setCatalogSelectedItemId(null);
    }
  };

  const editCatalogItem = (itemId: string): void => {
    const item = itemRecords[itemId];
    if (!item) return;
    setEditingItemId(item.id);
    beginCreation(null);
    setValues(toItemEditorValues(item));
    validation.reset();
    onSectionChange("catalog");
  };

  const duplicateCatalogItem = (itemId: string): void => {
    const item = itemRecords[itemId];
    if (!item) return;
    beginCreation(catalogEntries[`items:${item.id}`]?.folder_id ?? null);
    setEditingItemId(null);
    setCatalogSelectedItemId(null);
    setDraftItemId(makeId("item"));
    setSubmittedCreateId(null);
    setValues({
      ...duplicateItemEditorValues(item),
      name: nextDuplicateName(
        item.name,
        items.map((candidate) => candidate.name)
      )
    });
    validation.reset();
    onSectionChange("catalog");
  };

  if (section === "wizard") {
    return (
      <Panel
        variant="workspace"
        title="Wizard"
        subtitle="Guided Item creation for coordinated records such as weapons and their Actions."
      >
        <WeaponBuilderWizard
          client={client}
          proficiencies={proficiencies}
          intentFeedback={intentFeedback}
        />
      </Panel>
    );
  }

  return (
    <Panel
      variant="workspace"
      title="Catalog"
      subtitle="Browse saved Items and edit the selected definition in the full builder."
      actions={
        <div className="inline-actions">
          <button
            className="button button--primary"
            onClick={() => {
              startNewItem();
              setCatalogSelectedItemId(null);
            }}
          >
            New Item
          </button>
          {editingItemId ? (
            <>
              <button
                className="button button--secondary"
                onClick={() => duplicateCatalogItem(editingItemId)}
              >
                Duplicate
              </button>
              <button className="button button--danger" onClick={() => deleteItem(editingItemId)}>
                Delete Item
              </button>
            </>
          ) : null}
        </div>
      }
    >
      <div className="stack">
        {pendingPlayerItems.length > 0 ? (
          <section className="stack" aria-labelledby="pending-player-items-title">
            <div>
              <h3 id="pending-player-items-title">Player Item Approvals</h3>
              <p className="muted">
                Approval publishes the item to players and adds one copy to the submitting
                character. Denial permanently deletes the proposal.
              </p>
            </div>
            <div className="list">
              {pendingPlayerItems.map((item) => (
                <article className="list-item list-item--block" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <p className="muted">
                      Submitted by {item.submitted_by_name ?? "Unknown character"} ·{" "}
                      {item.interaction_type.replace("_", " ")} · {item.weight} lb
                    </p>
                    {item.description ? <p>{item.description}</p> : null}
                  </div>
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="button"
                      onClick={() =>
                        client.sendProtocolRequest(
                          buildReviewPlayerItemRequest({ itemId: item.id, approved: true }),
                          `Approve item: ${item.name}`
                        )
                      }
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="button button--danger"
                      onClick={() => {
                        if (
                          !confirmDestructiveAction({
                            action: "Deny",
                            subject: item.name,
                            consequence:
                              "This permanently deletes the pending player item proposal."
                          })
                        ) {
                          return;
                        }
                        client.sendProtocolRequest(
                          buildReviewPlayerItemRequest({ itemId: item.id, approved: false }),
                          `Deny item: ${item.name}`
                        );
                      }}
                    >
                      Deny
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
        <CatalogEditorLayout
          catalogLabel="Catalog"
          editorClassName="authoring-workspace__editor--vertical"
          catalog={
            <CatalogBrowser
              catalog="items"
              client={client}
              items={items.map((item) => ({
                id: item.id,
                name: item.name,
                searchText: [...(item.tags ?? []), item.rank ?? ""].join(" ")
              }))}
              selectedId={catalogSelectedItemId}
              entityLabel="item"
              emptyMessage="No items created yet."
              searchPlaceholder="Name, ID, tag, rank, or folder"
              onCreateEntry={(folderId) => {
                startNewItem(folderId);
                setCatalogSelectedItemId(null);
              }}
              onSelect={(itemId) => {
                setCatalogSelectedItemId(itemId);
                editCatalogItem(itemId);
              }}
            />
          }
        >
          <ItemEditorForm
            editingItemId={editingItemId}
            showPlayerAvailability
            values={values}
            validationAttempted={validation.attempted}
            onChange={setValues}
            actions={actions}
            attributeDefinitions={attributeDefinitions}
            proficiencies={proficiencyRecords}
            tagDefinitions={tagDefinitions}
            pending={Boolean(submittedCreateId)}
            attributesEditor={
              <ItemAttributesEditor
                values={values}
                definitions={attributeDefinitions}
                proficiencies={proficiencyRecords}
                metadata={actionFormulaAuthoringMetadata}
                onChange={setValues}
              />
            }
            effectEditor={
              <EffectReferenceEditor
                effects={standaloneEffects}
                selectedIds={values.effectIds}
                onChange={(effectIds) => setValues((current) => ({ ...current, effectIds }))}
                label="Equipment effects"
              />
            }
            effectEditorFocused={false}
            onSubmit={onSubmit}
            onCancel={showStart}
            onOpenActionAuthoring={() =>
              dispatch({ type: "set_gm_view", view: "action_authoring" })
            }
          />
        </CatalogEditorLayout>
      </div>
    </Panel>
  );
}
