import { useState } from "react";
import { useAppStore } from "@/app/state/store";
import type { SheetTemplate } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { buildCreateTemplateIntent } from "@/features/sheets/intentBuilders";
import { TemplateEditorForm, type TemplateEditorValues } from "@/features/sheets/TemplateEditorForm";
import {
  createEmptyTemplateEditorValues,
  parseTemplateCoreStats,
  parseTemplateTags
} from "@/features/sheets/templateEditorValues";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

export function TemplateCreatePage({ client }: { client: GameClient }): JSX.Element {
  const { dispatch } = useAppStore();
  const [createValues, setCreateValues] = useState<TemplateEditorValues>(() =>
    createEmptyTemplateEditorValues("player")
  );

  const createTemplate = (): void => {
    if (!createValues.name.trim()) {
      return;
    }

    const template: SheetTemplate = {
      id: makeId("template"),
      mode: "template",
      kind: createValues.kind,
      name: createValues.name.trim(),
      notes: createValues.notes.trim(),
      stats: parseTemplateCoreStats(createValues.coreStats),
      tags: parseTemplateTags(createValues.tags),
      updatedAt: new Date().toISOString()
    };

    client.sendIntent(buildCreateTemplateIntent(template));

    setCreateValues(createEmptyTemplateEditorValues(createValues.kind));
  };

  return (
    <Panel
      title="Create Template"
      actions={
        <button
          className="button button--secondary"
          onClick={() => dispatch({ type: "set_gm_view", view: "template_library" })}
        >
          Back to Template Library
        </button>
      }
    >
      <div className="stack">
        <p className="muted">Template creation is isolated on this page by design.</p>
        <TemplateEditorForm
          title="New Template"
          submitLabel="Create Template"
          values={createValues}
          onChange={setCreateValues}
          onSubmit={createTemplate}
        />
      </div>
    </Panel>
  );
}
