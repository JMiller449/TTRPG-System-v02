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
    () => attributeOrder.map((id) => attributes[id]).filter((attribute): attribute is AttributeDefinition => Boolean(attribute)),
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
    <Panel title="Attribute Builder">
      <div className="stack">
        <AttributeEditorForm
          editingId={editingId}
          draft={draft}
          metadata={actionFormulaAuthoringMetadata}
          onChange={setDraft}
          onSubmit={submit}
          onCancel={editingId ? reset : undefined}
        />

        {orderedAttributes.map((attribute) => (
          <article key={attribute.id} className="card stack">
            <div className="inline-actions">
              <strong>{attribute.name}</strong>
              {attribute.required ? <span className="badge">Required</span> : null}
              {attribute.backend_owned && !attribute.required ? <span className="badge">Preset</span> : null}
            </div>
            <p className="muted">
              {attribute.subject_types.join(", ")} · {attribute.value_type} · default{" "}
              {attributeValueText(attribute.default_value)}
            </p>
            {attribute.description ? <p>{attribute.description}</p> : null}
            {!attribute.backend_owned ? (
              <div className="inline-actions">
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(attribute.id);
                    setDraft(draftFromAttribute(attribute));
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() =>
                    client.sendProtocolRequest(
                      buildDeleteAttributeRequest({ attributeId: attribute.id }),
                      `Delete Attribute: ${attribute.name}`
                    )
                  }
                >
                  Delete
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </Panel>
  );
}
