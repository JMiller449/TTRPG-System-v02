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
import { CatalogTileGrid } from "@/shared/ui/CatalogTileGrid";
import { makeId } from "@/shared/utils/id";

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
  const requestedMetadataRef = useRef(false);
  const orderedAttributes = useMemo(
    () =>
      attributeOrder
        .map((id) => attributes[id])
        .filter((attribute): attribute is AttributeDefinition => Boolean(attribute))
        .filter((attribute) => !attribute.backend_owned),
    [attributeOrder, attributes]
  );

  useEffect(() => {
    if (actionFormulaAuthoringMetadata || requestedMetadataRef.current) {
      return;
    }
    requestedMetadataRef.current = true;
    const submission = buildLoadActionFormulaAuthoringMetadataSubmission();
    client.sendProtocolRequest(submission.request, submission.label);
  }, [actionFormulaAuthoringMetadata, client]);

  const reset = (): void => {
    setEditingId(null);
    setDraft(emptyAttributeDraft());
  };

  const submit = (): void => {
    const id = editingId ?? makeId("attribute");
    const attribute = attributePayloadFromDraft(draft, id);
    if (!attribute) {
      return;
    }
    client.sendProtocolRequest(
      editingId
        ? buildUpdateAttributeRequest({ attributeId: editingId, attribute })
        : buildCreateAttributeRequest({ attribute }),
      editingId ? `Update Attribute: ${attribute.name}` : `Create Attribute: ${attribute.name}`
    );
    reset();
  };

  return (
    <Panel
      title="Attribute Builder"
      subtitle="Attributes are typed facts — like Range or Mana Cost — that sheets, items, and actions can carry."
      actions={
        editingId ? (
          <div className="inline-actions">
            <button className="button button--secondary" type="button" onClick={reset}>
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
        catalog={
          <CatalogTileGrid
            items={orderedAttributes.map((attribute) => ({
              id: attribute.id,
              name: attribute.name
            }))}
            selectedId={editingId}
            emptyMessage="No custom attributes yet. Built-in attributes are managed by the system and stay out of this list."
            onSelect={(attributeId) => {
              const attribute = attributes[attributeId];
              if (!attribute || attribute.backend_owned) {
                return;
              }
              setEditingId(attribute.id);
              setDraft(draftFromAttribute(attribute));
            }}
          />
        }
      >
        <AttributeEditorForm
          editingId={editingId}
          draft={draft}
          metadata={actionFormulaAuthoringMetadata}
          onChange={setDraft}
          onSubmit={submit}
          onCancel={editingId ? reset : undefined}
        />
      </CatalogEditorLayout>
    </Panel>
  );
}
