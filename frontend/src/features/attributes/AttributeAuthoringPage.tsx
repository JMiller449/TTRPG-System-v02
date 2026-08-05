import { useEffect, useMemo, useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { AttributeDefinition, AttributeValue } from "@/domain/models";
import { buildLoadActionFormulaAuthoringMetadataSubmission } from "@/features/actions/actionAuthoringRequests";
import { AttributeEditorForm } from "@/features/attributes/components/AttributeEditorForm";
import {
  emptyAttributeDraft,
  attributePayloadFromDraft,
  type AttributeDraft
} from "@/features/attributes/attributeEditorValues";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildCreateAttributeRequest,
  buildDeleteAttributeRequest,
  buildUpdateAttributeRequest
} from "@/infrastructure/ws/requestBuilders";
import { Panel } from "@/shared/ui/Panel";
import { CatalogEditorLayout } from "@/shared/ui/CatalogEditorLayout";
import { CatalogBrowser } from "@/features/catalogs/CatalogBrowser";
import { useCatalogCreationTarget } from "@/features/catalogs/useCatalogCreationTarget";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { makeId } from "@/shared/utils/id";
import { useFormValidationAttempt } from "@/shared/ui/useFormValidationAttempt";

function attributeValueText(value: AttributeValue): string {
  if (value.type === "formula") {
    return value.formula.text;
  }
  if (Array.isArray(value.value)) {
    return value.value.join(", ");
  }
  return String(value.value);
}

function draftFromAttribute(attribute: AttributeDefinition): AttributeDraft {
  return {
    name: attribute.name,
    description: attribute.description ?? "",
    subjectTypes: attribute.subject_types,
    valueType: attribute.value_type,
    numberMode: attribute.default_value.type === "formula" ? "formula" : "literal",
    formulaAliases:
      attribute.default_value.type === "formula"
        ? (attribute.default_value.formula.aliases ?? []).map((alias) => ({
            ...alias,
            path: [...alias.path]
          }))
        : [],
    defaultText: attributeValueText(attribute.default_value),
    unit: attribute.unit ?? "",
    visibility: attribute.visibility ?? "public",
    validationOptions: (attribute.validation_options ?? []).join(", "),
    referenceKind: attribute.reference_kind ?? ""
  };
}

export function AttributeAuthoringPage({ client }: { client: GameClient }): JSX.Element {
  const { state } = useAppStore();
  const { attributes, attributeOrder } = state.serverState;
  const { actionFormulaAuthoringMetadata } = state.uiState;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AttributeDraft>(emptyAttributeDraft);
  const validation = useFormValidationAttempt();
  const requestedMetadataRef = useRef(false);
  const orderedAttributes = useMemo(
    () =>
      attributeOrder
        .map((id) => attributes[id])
        .filter((attribute): attribute is AttributeDefinition => Boolean(attribute))
        .filter((attribute) => !attribute.backend_owned),
    [attributeOrder, attributes]
  );
  const { beginCreation, queueCreatedEntry } = useCatalogCreationTarget({
    catalog: "attributes",
    client,
    entries: attributes
  });

  useEffect(() => {
    if (actionFormulaAuthoringMetadata || requestedMetadataRef.current) {
      return;
    }
    requestedMetadataRef.current = true;
    const submission = buildLoadActionFormulaAuthoringMetadataSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  }, [actionFormulaAuthoringMetadata, client]);

  const reset = (folderId: string | null = null): void => {
    validation.reset();
    beginCreation(folderId);
    setEditingId(null);
    setDraft(emptyAttributeDraft());
  };

  const submit = (): void => {
    const id = editingId ?? makeId("attribute");
    const attribute = attributePayloadFromDraft(draft, id);
    if (!validation.validate(Boolean(attribute)) || !attribute) {
      return;
    }
    client.sendProtocolRequest(
      editingId
        ? buildUpdateAttributeRequest({ attributeId: editingId, attribute })
        : buildCreateAttributeRequest({ attribute }),
      editingId ? `Update Attribute: ${attribute.name}` : `Create Attribute: ${attribute.name}`
    );
    if (!editingId) {
      queueCreatedEntry(id);
    }
    reset();
  };

  return (
    <Panel
      title="Attribute Builder"
      subtitle="Attributes are typed facts — like Range or Mana Cost — that sheets, items, and actions can carry."
      actions={
        editingId ? (
          <div className="inline-actions">
            <button className="button button--secondary" type="button" onClick={() => reset()}>
              New Attribute
            </button>
            <button
              className="button button--danger"
              type="button"
              onClick={() => {
                const attribute = attributes[editingId];
                if (!attribute || attribute.backend_owned) {
                  return;
                }
                if (
                  !confirmDestructiveAction({
                    action: "Delete",
                    subject: attribute.name,
                    consequence:
                      "This permanently deletes the Attribute definition. Existing attachment and formula dependency checks still apply."
                  })
                ) {
                  return;
                }
                client.sendProtocolRequest(
                  buildDeleteAttributeRequest({ attributeId: attribute.id }),
                  `Delete Attribute: ${attribute.name}`
                );
                reset();
              }}
            >
              Delete Attribute
            </button>
          </div>
        ) : null
      }
    >
      <CatalogEditorLayout
        catalogLabel="Attribute Catalog"
        editorClassName="authoring-workspace__editor--vertical"
        catalog={
          <CatalogBrowser
            catalog="attributes"
            client={client}
            items={orderedAttributes.map((attribute) => ({
              id: attribute.id,
              name: attribute.name
            }))}
            selectedId={editingId}
            entityLabel="attribute"
            emptyMessage="No custom attributes yet. Built-in attributes are managed by the system and stay out of this list."
            onCreateEntry={reset}
            onSelect={(attributeId) => {
              const attribute = attributes[attributeId];
              if (!attribute || attribute.backend_owned) {
                return;
              }
              beginCreation(null);
              setEditingId(attribute.id);
              setDraft(draftFromAttribute(attribute));
              validation.reset();
            }}
          />
        }
      >
        <AttributeEditorForm
          editingId={editingId}
          draft={draft}
          validationAttempted={validation.attempted}
          metadata={actionFormulaAuthoringMetadata}
          onChange={setDraft}
          onSubmit={submit}
          onCancel={editingId ? reset : undefined}
        />
      </CatalogEditorLayout>
    </Panel>
  );
}
