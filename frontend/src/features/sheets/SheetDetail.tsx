import { useMemo, useState } from "react";
import { useAppStore } from "@/app/state/store";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Panel } from "@/shared/ui/Panel";

export function SheetDetail({ title = "Sheet Detail" }: { title?: string } = {}): JSX.Element {
  const {
    state: {
      activeSheetId,
      instances,
      templates,
      localSheetEquipment,
      localSheetActiveWeapon,
      localSheetStatOverrides
    },
    dispatch
  } = useAppStore();
  const [equipmentDraft, setEquipmentDraft] = useState("");

  const detail = useMemo(() => {
    if (!activeSheetId) {
      return null;
    }
    const instance = instances[activeSheetId];
    if (!instance) {
      return null;
    }
    const template = templates[instance.templateId];
    const baseStats = template?.stats ?? {};
    const statOverrides = localSheetStatOverrides[instance.id] ?? {};
    return {
      instance,
      template,
      stats: {
        ...baseStats,
        ...statOverrides
      }
    };
  }, [activeSheetId, instances, templates, localSheetStatOverrides]);

  return (
    <Panel title={title}>
      {!detail ? (
        <EmptyState message="Select or spawn a sheet instance." />
      ) : (
        <div className="stack">
          <h3>{detail.instance.name}</h3>
          <p className="muted">
            {detail.instance.kind} · template: {detail.template?.name ?? detail.instance.templateId}
          </p>
          <p>{detail.instance.notes || "No notes set."}</p>

          <div className="stats-grid">
            {Object.entries(detail.stats).map(([key, value]) => (
              <div key={key} className="stat-item">
                <span className="muted">{key}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>

          <div className="stack">
            <strong>Equipment (Inventory List)</strong>
            <div className="equipment-add-row">
              <input
                value={equipmentDraft}
                onChange={(event) => setEquipmentDraft(event.target.value)}
                placeholder="e.g. Steel Dagger"
              />
              <button
                className="button"
                onClick={() => {
                  const value = equipmentDraft.trim();
                  if (!value) {
                    return;
                  }
                  dispatch({ type: "add_sheet_equipment", sheetId: detail.instance.id, item: value });
                  if (!localSheetActiveWeapon[detail.instance.id]) {
                    dispatch({ type: "set_sheet_active_weapon", sheetId: detail.instance.id, item: value });
                  }
                  setEquipmentDraft("");
                }}
              >
                Add
              </button>
            </div>
            <p className="muted">
              Active weapon: {localSheetActiveWeapon[detail.instance.id] ?? "None"}
            </p>
            <div className="list">
              {(localSheetEquipment[detail.instance.id] ?? []).length === 0 ? (
                <p className="empty-state">No equipment added yet.</p>
              ) : null}
              {(localSheetEquipment[detail.instance.id] ?? []).map((item, index) => (
                <article key={`${item}_${index}`} className="list-item">
                  <div>
                    <strong>{item}</strong>
                    {localSheetActiveWeapon[detail.instance.id] === item ? (
                      <div className="muted">Active weapon</div>
                    ) : null}
                  </div>
                  <div className="inline-actions">
                    <button
                      className="button button--secondary"
                      onClick={() =>
                        dispatch({
                          type: "set_sheet_active_weapon",
                          sheetId: detail.instance.id,
                          item: localSheetActiveWeapon[detail.instance.id] === item ? null : item
                        })
                      }
                    >
                      {localSheetActiveWeapon[detail.instance.id] === item ? "Clear Active" : "Set Active"}
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() =>
                        dispatch({
                          type: "remove_sheet_equipment",
                          sheetId: detail.instance.id,
                          index
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* TODO: Add editable fields once backend update endpoints are finalized. */}
        </div>
      )}
    </Panel>
  );
}
