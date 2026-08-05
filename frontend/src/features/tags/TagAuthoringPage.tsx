import { useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import { CatalogBrowser } from "@/features/catalogs/CatalogBrowser";
import { useCatalogCreationTarget } from "@/features/catalogs/useCatalogCreationTarget";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildCreateTagRequest,
  buildDeleteTagRequest,
  buildUpdateTagRequest
} from "@/infrastructure/ws/requestBuilders";
import { CatalogEditorLayout } from "@/shared/ui/CatalogEditorLayout";
import { Field } from "@/shared/ui/Field";
import { FormValidationSummary } from "@/shared/ui/FormValidationSummary";
import { Panel } from "@/shared/ui/Panel";
import { useFormValidationAttempt } from "@/shared/ui/useFormValidationAttempt";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { makeId } from "@/shared/utils/id";

type TagDraft = {
  name: string;
  description: string;
};

const emptyDraft = (): TagDraft => ({ name: "", description: "" });

export function TagAuthoringPage({ client }: { client: GameClient }): JSX.Element {
  const {
    state: {
      serverState: { tags, tagOrder }
    }
  } = useAppStore();
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [draftTagId, setDraftTagId] = useState(() => makeId("tag"));
  const [draft, setDraft] = useState<TagDraft>(emptyDraft);
  const validation = useFormValidationAttempt();
  const { beginCreation, queueCreatedEntry } = useCatalogCreationTarget({
    catalog: "tags",
    client,
    entries: tags
  });

  const startNew = (folderId: string | null = null): void => {
    validation.reset();
    beginCreation(folderId);
    setEditingTagId(null);
    setDraftTagId(makeId("tag"));
    setDraft(emptyDraft());
  };

  const save = (): void => {
    const name = draft.name.trim();
    if (!validation.validate(Boolean(name))) return;
    const tag = {
      id: editingTagId ?? draftTagId,
      name,
      description: draft.description.trim()
    };
    if (editingTagId) {
      client.sendProtocolRequest(
        buildUpdateTagRequest({ tagId: editingTagId, tag }),
        `Update tag: ${name}`
      );
    } else {
      client.sendProtocolRequest(buildCreateTagRequest({ tag }), `Create tag: ${name}`);
      queueCreatedEntry(draftTagId);
    }
    startNew();
  };

  const remove = (tagId: string): void => {
    const tag = tags[tagId];
    if (
      !confirmDestructiveAction({
        action: "Delete",
        subject: tag?.name ?? tagId,
        consequence: "Referenced tags cannot be deleted. Folder placement is unaffected."
      })
    ) {
      return;
    }
    client.sendProtocolRequest(
      buildDeleteTagRequest({ tagId }),
      `Delete tag: ${tag?.name ?? tagId}`
    );
    if (editingTagId === tagId) startNew();
  };

  return (
    <Panel
      title="Tag Management"
      subtitle="Reusable classification and formula-context tags. Folders organize tags without adding mechanics."
      actions={
        editingTagId ? (
          <button className="button button--secondary" type="button" onClick={() => startNew()}>
            New Tag
          </button>
        ) : null
      }
    >
      <CatalogEditorLayout
        catalogLabel="Tag Catalog"
        editorClassName="authoring-workspace__editor--vertical"
        catalog={
          <CatalogBrowser
            catalog="tags"
            client={client}
            items={tagOrder.flatMap((tagId) => {
              const tag = tags[tagId];
              return tag ? [{ id: tag.id, name: tag.name, searchText: tag.description }] : [];
            })}
            selectedId={editingTagId}
            entityLabel="tag"
            emptyMessage="No tags created yet."
            searchPlaceholder="Name, ID, description, or folder"
            onCreateEntry={startNew}
            onSelect={(tagId) => {
              const tag = tags[tagId];
              if (!tag) return;
              beginCreation(null);
              setEditingTagId(tagId);
              setDraft({ name: tag.name, description: tag.description });
              validation.reset();
            }}
          />
        }
      >
        <section className="stack" aria-label={editingTagId ? "Edit tag" : "Create tag"}>
          <h3>{editingTagId ? "Edit Tag" : "Create Tag"}</h3>
          <Field label="Name" required invalid={validation.attempted && !draft.name.trim()}>
            <input
              value={draft.name}
              required
              aria-invalid={validation.attempted && !draft.name.trim()}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              placeholder="e.g. Long Sword"
            />
          </Field>
          <Field label="Description">
            <textarea
              rows={4}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              placeholder="How this tag is intended to be used"
            />
          </Field>
          <FormValidationSummary visible={validation.attempted && !draft.name.trim()} />
          <div className="inline-actions">
            <button className="button button--primary" type="button" onClick={save}>
              {editingTagId ? "Save Tag" : "Create Tag"}
            </button>
            {editingTagId ? (
              <button
                className="button button--danger"
                type="button"
                onClick={() => remove(editingTagId)}
              >
                Delete Tag
              </button>
            ) : null}
          </div>
        </section>
      </CatalogEditorLayout>
    </Panel>
  );
}
