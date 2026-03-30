import { useState } from "react";
import { useAppStore } from "@/app/state/store";
import type { Sheet } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { buildCreateSheetIntent } from "@/features/sheets/intentBuilders";
import { TemplateEditorForm, type TemplateEditorValues } from "@/features/sheets/TemplateEditorForm";
import {
  createEmptyTemplateEditorValues,
  createDefaultStats,
  toSheetPresentation
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

    const sheet: Sheet = {
      id: makeId("template"),
      name: createValues.name.trim(),
      dm_only: createValues.kind === "enemy",
      xp_given_when_slayed: 0,
      xp_cap: "",
      proficiencies: {},
      items: {},
      stats: {
        ...createDefaultStats(),
        strength: Number(createValues.coreStats.strength || 0),
        dexterity: Number(createValues.coreStats.dexterity || 0),
        constitution: Number(createValues.coreStats.constitution || 0),
        perception: Number(createValues.coreStats.perception || 0),
        arcane: Number(createValues.coreStats.arcane || 0),
        will: Number(createValues.coreStats.will || 0)
      },
      slayed_record: {},
      actions: {}
    };

    client.sendIntent(buildCreateSheetIntent(sheet, toSheetPresentation(createValues)));

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
