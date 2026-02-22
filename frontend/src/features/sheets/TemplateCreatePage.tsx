import { useState } from "react";
import { useAppStore } from "@/app/state/store";
import type { SheetKind, SheetTemplate, StatKey } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import {
  CORE_TEMPLATE_STATS,
  TemplateEditorForm,
  type TemplateEditorValues
} from "@/features/sheets/TemplateEditorForm";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

function createEmptyValues(kind: SheetKind = "player"): TemplateEditorValues {
  return {
    kind,
    name: "",
    notes: "",
    tags: kind,
    coreStats: CORE_TEMPLATE_STATS.reduce(
      (acc, key) => ({ ...acc, [key]: "" }),
      {} as TemplateEditorValues["coreStats"]
    )
  };
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseCoreStats(values: TemplateEditorValues["coreStats"]): Partial<Record<StatKey, number>> {
  return Object.fromEntries(
    Object.entries(values)
      .filter((entry) => entry[1].trim() !== "")
      .map(([key, raw]) => [key, Number(raw)])
      .filter((entry) => Number.isFinite(entry[1]))
  ) as Partial<Record<StatKey, number>>;
}

export function TemplateCreatePage({ client }: { client: GameClient }): JSX.Element {
  const { dispatch } = useAppStore();
  const [createValues, setCreateValues] = useState<TemplateEditorValues>(() => createEmptyValues("player"));

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
      stats: parseCoreStats(createValues.coreStats),
      tags: parseTags(createValues.tags),
      updatedAt: new Date().toISOString()
    };

    client.sendIntent({
      intentId: makeId("intent"),
      type: "create_template",
      payload: { template }
    });

    setCreateValues(createEmptyValues(createValues.kind));
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
