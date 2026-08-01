import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { buildLoadActionFormulaAuthoringMetadataSubmission } from "@/features/actions/actionAuthoringRequests";
import type { GameClient } from "@/hooks/useGameClient";
import { ItemAugmentationTemplatePanel } from "@/features/augmentations/components/ItemAugmentationTemplatePanel";
import {
  createEmptyAugmentationEditorValues,
  hasValidAugmentationEditorValues,
  isKnownAugmentationEditorTarget,
  toAugmentationEditorValues,
  toItemAugmentationTemplatePayload,
  type AugmentationEditorValues
} from "@/features/augmentations/augmentationEditorValues";
import { buildAugmentationSelectorOptions } from "@/features/augmentations/augmentationSelectorOptions";
import { buildLoadItemAugmentationTargetMetadataSubmission } from "@/features/augmentations/augmentationRequests";
import { ItemEditorForm } from "@/features/items/components/ItemEditorForm";
import { ItemAttributesEditor } from "@/features/items/components/ItemAttributesEditor";
import { CatalogBrowser } from "@/features/catalogs/CatalogBrowser";
import { useCatalogCreationTarget } from "@/features/catalogs/useCatalogCreationTarget";
import {
  createEmptyItemValues,
  createItemValuesFromTemplate,
  getItemEditorValidationError,
  toItemDefinitionPayload,
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
import {
  buildCreateItemTemplateRequest,
  buildDeleteItemTemplateRequest,
  buildUpdateItemTemplateRequest
} from "@/infrastructure/ws/requestBuilders";
import { Panel } from "@/shared/ui/Panel";
import { CatalogEditorLayout } from "@/shared/ui/CatalogEditorLayout";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { makeId } from "@/shared/utils/id";
import { CatalogEntityPicker } from "@/features/catalogs/CatalogEntityPicker";
import { useFormValidationAttempt } from "@/shared/ui/useFormValidationAttempt";

type ItemWorkspaceMode = "start" | "item" | "choose_template" | "template_idle" | "templates";

export function ItemMakerPage({
  client,
  templateManagement = false
}: {
  client: GameClient;
  templateManagement?: boolean;
}): JSX.Element {
  const {
    state: {
      serverState: {
        items: itemRecords,
        itemOrder,
        itemTemplates: itemTemplateRecords,
        itemTemplateOrder,
        actions: actionRecords,
        actionOrder,
        formulas: formulaRecords,
        formulaOrder,
        attributes: attributeDefinitions,
        proficiencies: proficiencyRecords,
        tags: tagDefinitions
      },
      uiState: { augmentationTargetMetadata, actionFormulaAuthoringMetadata }
    },
    dispatch
  } = useAppStore();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<ItemWorkspaceMode>(
    templateManagement ? "template_idle" : "start"
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [draftItemId, setDraftItemId] = useState(() => makeId("item"));
  const [submittedCreateId, setSubmittedCreateId] = useState<string | null>(null);
  const [values, setValues] = useState<ItemEditorValues>(createEmptyItemValues);
  const [editingAugmentationId, setEditingAugmentationId] = useState<string | null>(null);
  const [augmentationValues, setAugmentationValues] = useState<AugmentationEditorValues>(
    createEmptyAugmentationEditorValues
  );
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
  const itemTemplates = useMemo(
    () => selectOrderedItemDefinitions(itemTemplateRecords, itemTemplateOrder),
    [itemTemplateOrder, itemTemplateRecords]
  );
  const actions = useMemo(
    () => actionOrder.map((id) => actionRecords[id]).filter(Boolean),
    [actionOrder, actionRecords]
  );
  const selectorOptions = useMemo(
    () =>
      buildAugmentationSelectorOptions({
        actionRecords,
        actionOrder,
        formulaRecords,
        formulaOrder
      }),
    [actionOrder, actionRecords, formulaOrder, formulaRecords]
  );
  const targetOptions =
    augmentationTargetMetadata?.context === "item_template"
      ? augmentationTargetMetadata.targets
      : [];
  const { beginCreation, queueCreatedEntry } = useCatalogCreationTarget({
    catalog: "items",
    client,
    entries: itemRecords
  });
  const { beginCreation: beginTemplateCreation, queueCreatedEntry: queueCreatedTemplateEntry } =
    useCatalogCreationTarget({
      catalog: "item_templates",
      client,
      entries: itemTemplateRecords
    });

  useEffect(() => {
    if (augmentationTargetMetadata?.context === "item_template") {
      return;
    }

    const submission = buildLoadItemAugmentationTargetMetadataSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  }, [augmentationTargetMetadata?.context, client]);

  useEffect(() => {
    if (actionFormulaAuthoringMetadata || requestedFormulaMetadataRef.current) {
      return;
    }
    requestedFormulaMetadataRef.current = true;
    const submission = buildLoadActionFormulaAuthoringMetadataSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  }, [actionFormulaAuthoringMetadata, client]);

  const resetAugmentationEditor = (): void => {
    setEditingAugmentationId(null);
    setAugmentationValues(createEmptyAugmentationEditorValues());
  };

  const startNewItem = (folderId: string | null = null): void => {
    validation.reset();
    beginCreation(folderId);
    setEditingItemId(null);
    setEditingTemplateId(null);
    setWorkspaceMode("item");
    setDraftItemId(makeId("item"));
    setSubmittedCreateId(null);
    setValues(createEmptyItemValues());
    resetAugmentationEditor();
  };

  const showStart = (): void => {
    validation.reset();
    if (templateManagement) {
      beginTemplateCreation(null);
    } else {
      beginCreation(null);
    }
    setEditingItemId(null);
    setEditingTemplateId(null);
    setWorkspaceMode(templateManagement ? "template_idle" : "start");
    setSelectedTemplateId("");
    setValues(createEmptyItemValues());
    resetAugmentationEditor();
  };

  const startNewTemplate = (folderId: string | null = null): void => {
    validation.reset();
    beginTemplateCreation(folderId);
    setEditingItemId(null);
    setEditingTemplateId(null);
    setWorkspaceMode("templates");
    setDraftItemId(makeId("item_template"));
    setValues(createEmptyItemValues());
    resetAugmentationEditor();
  };

  useEffect(() => {
    if (submittedCreateId && itemRecords[submittedCreateId]) {
      setEditingItemId(null);
      setDraftItemId(makeId("item"));
      setSubmittedCreateId(null);
      setWorkspaceMode("start");
      setValues(createEmptyItemValues());
      setEditingAugmentationId(null);
      setAugmentationValues(createEmptyAugmentationEditorValues());
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
    if (workspaceMode === "templates") {
      const templateId = editingTemplateId ?? draftItemId;
      const template = {
        ...toItemDefinitionPayload(values, templateId),
        player_catalog_access: { mode: "none" as const, instance_ids: [] }
      };
      client.sendProtocolRequest(
        editingTemplateId
          ? buildUpdateItemTemplateRequest({
              templateId: editingTemplateId,
              template
            })
          : buildCreateItemTemplateRequest({ template }),
        `${editingTemplateId ? "Update" : "Create"} item template: ${template.name}`
      );
      if (!editingTemplateId) {
        queueCreatedTemplateEntry(templateId);
      }
      showStart();
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

  const deleteTemplate = (templateId: string): void => {
    const template = itemTemplateRecords[templateId];
    if (
      !confirmDestructiveAction({
        action: "Delete",
        subject: template?.name ?? templateId,
        consequence:
          "This deletes the reusable template. Items previously created from it remain unchanged."
      })
    ) {
      return;
    }
    client.sendProtocolRequest(
      buildDeleteItemTemplateRequest({ templateId }),
      `Delete item template: ${template?.name ?? templateId}`
    );
    showStart();
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
      itemId: editingItemId ?? "draft-item",
      itemName: values.name
    });
    setValues((current) => ({
      ...current,
      augmentationTemplates: editingAugmentationId
        ? current.augmentationTemplates.map((template) =>
            template.id === editingAugmentationId ? augmentation : template
          )
        : [...current.augmentationTemplates, augmentation]
    }));
    resetAugmentationEditor();
  };

  const removeAugmentation = (augmentationId: string): void => {
    const augmentation = values.augmentationTemplates.find(
      (candidate) => candidate.id === augmentationId
    );
    if (
      !confirmDestructiveAction({
        action: "Remove",
        subject: augmentation?.name ?? augmentationId,
        consequence: "This removes the effect from the item draft when you save it."
      })
    ) {
      return;
    }
    setValues((current) => ({
      ...current,
      augmentationTemplates: current.augmentationTemplates.filter(
        (template) => template.id !== augmentationId
      )
    }));
    if (editingAugmentationId === augmentationId) {
      resetAugmentationEditor();
    }
  };

  return (
    <Panel
      title={templateManagement ? "Item Template Builder" : "Item / Equipment Maker"}
      subtitle={
        templateManagement
          ? "Reusable starting points for item creation. Existing items remain independent."
          : "Gear, consumables, and loot. Items can grant actions and passive effects to whoever carries or equips them."
      }
      actions={
        (
          templateManagement
            ? workspaceMode === "templates"
            : Boolean(editingItemId) || workspaceMode !== "start"
        ) ? (
          <div className="inline-actions">
            <button className="button button--secondary" onClick={showStart}>
              {templateManagement ? "Template Start" : "Item Start"}
            </button>
            {editingItemId ? (
              <button className="button button--danger" onClick={() => deleteItem(editingItemId)}>
                Delete Item
              </button>
            ) : null}
            {editingTemplateId ? (
              <button
                className="button button--danger"
                onClick={() => deleteTemplate(editingTemplateId)}
              >
                Delete Template
              </button>
            ) : null}
          </div>
        ) : null
      }
    >
      <div className="stack">
        {!templateManagement && pendingPlayerItems.length > 0 ? (
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
          catalogLabel={templateManagement ? "Item Templates" : "Item Catalog"}
          catalog={
            templateManagement ? (
              <CatalogBrowser
                catalog="item_templates"
                client={client}
                items={itemTemplates.map((template) => ({
                  id: template.id,
                  name: template.name,
                  searchText: [...(template.tags ?? []), template.rank ?? ""].join(" ")
                }))}
                selectedId={editingTemplateId}
                entityLabel="item template"
                emptyMessage="No item templates created yet."
                searchPlaceholder="Name, ID, tag, rank, or folder"
                onCreateEntry={startNewTemplate}
                onSelect={(templateId) => {
                  const template = itemTemplateRecords[templateId];
                  if (!template) return;
                  setEditingTemplateId(templateId);
                  setEditingItemId(null);
                  setWorkspaceMode("templates");
                  beginTemplateCreation(null);
                  setValues(toItemEditorValues(template));
                  resetAugmentationEditor();
                  validation.reset();
                }}
              />
            ) : (
              <CatalogBrowser
                catalog="items"
                client={client}
                items={items.map((item) => ({
                  id: item.id,
                  name: item.name,
                  searchText: [...(item.tags ?? []), item.rank ?? ""].join(" ")
                }))}
                selectedId={editingItemId}
                entityLabel="item"
                emptyMessage="No items created yet."
                searchPlaceholder="Name, ID, tag, rank, or folder"
                onCreateEntry={startNewItem}
                onSelect={(itemId) => {
                  const item = itemRecords[itemId];
                  if (!item) return;
                  setEditingItemId(item.id);
                  setEditingTemplateId(null);
                  setWorkspaceMode("item");
                  beginCreation(null);
                  setValues(toItemEditorValues(item));
                  resetAugmentationEditor();
                  validation.reset();
                }}
              />
            )
          }
        >
          {templateManagement && workspaceMode === "template_idle" ? (
            <section className="stack item-creation-start" aria-label="Start template creation">
              <div>
                <h3>Build an item template</h3>
                <p className="muted">
                  Create reusable defaults here, or select an existing template from the catalog to
                  edit it.
                </p>
              </div>
              <div className="inline-actions">
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => startNewTemplate()}
                >
                  New Item Template
                </button>
              </div>
            </section>
          ) : workspaceMode === "start" ? (
            <section className="stack item-creation-start" aria-label="Start item creation">
              <div>
                <h3>Create an item</h3>
                <p className="muted">
                  Begin with an empty draft or copy reusable defaults from an item template.
                </p>
              </div>
              <div className="inline-actions">
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => startNewItem()}
                >
                  Start from Scratch
                </button>
                <button
                  className="button button--secondary"
                  type="button"
                  onClick={() => setWorkspaceMode("choose_template")}
                >
                  Use a Template
                </button>
              </div>
            </section>
          ) : workspaceMode === "choose_template" ? (
            <section className="stack" aria-label="Choose item template">
              <h3>Choose an Item Template</h3>
              <CatalogEntityPicker
                catalog="item_templates"
                label="Template"
                placeholder="Search item templates"
                selectedId={selectedTemplateId}
                options={itemTemplates.map((template) => ({
                  id: template.id,
                  label: template.name,
                  secondary: (template.tags ?? []).join(", "),
                  value: template.id
                }))}
                emptyMessage="No item templates exist yet."
                onSelect={setSelectedTemplateId}
              />
              <div className="inline-actions">
                <button
                  className="button button--primary"
                  type="button"
                  disabled={!selectedTemplateId}
                  onClick={() => {
                    const template = itemTemplateRecords[selectedTemplateId];
                    if (!template) return;
                    setValues(createItemValuesFromTemplate(template));
                    setDraftItemId(makeId("item"));
                    setWorkspaceMode("item");
                    setEditingItemId(null);
                    resetAugmentationEditor();
                    validation.reset();
                  }}
                >
                  Use Template
                </button>
                <button className="button button--secondary" type="button" onClick={showStart}>
                  Cancel
                </button>
              </div>
            </section>
          ) : (
            <ItemEditorForm
              editingItemId={templateManagement ? editingTemplateId : editingItemId}
              editorKind={templateManagement ? "template" : "item"}
              showPlayerAvailability={!templateManagement}
              values={values}
              validationAttempted={validation.attempted}
              onChange={setValues}
              actions={actions}
              attributeDefinitions={attributeDefinitions}
              proficiencies={proficiencyRecords}
              tagDefinitions={tagDefinitions}
              pending={
                !templateManagement && workspaceMode === "item" && Boolean(submittedCreateId)
              }
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
                <ItemAugmentationTemplatePanel
                  itemName={values.name.trim() || "New equippable item"}
                  editingAugmentationId={editingAugmentationId}
                  templates={values.augmentationTemplates}
                  targetOptions={targetOptions}
                  selectorOptions={selectorOptions}
                  formulaMetadata={actionFormulaAuthoringMetadata}
                  values={augmentationValues}
                  onChange={setAugmentationValues}
                  onSubmit={submitAugmentation}
                  onCancel={resetAugmentationEditor}
                  onEdit={(augmentation) => {
                    setEditingAugmentationId(augmentation.id);
                    setAugmentationValues(toAugmentationEditorValues(augmentation));
                  }}
                  onRemove={removeAugmentation}
                />
              }
              onSubmit={onSubmit}
              onCancel={showStart}
              onOpenActionAuthoring={() =>
                dispatch({ type: "set_gm_view", view: "action_authoring" })
              }
            />
          )}
        </CatalogEditorLayout>
      </div>
    </Panel>
  );
}
