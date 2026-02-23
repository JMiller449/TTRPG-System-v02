import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/app/state/store";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

export function SheetDetail({ title = "Sheet Detail" }: { title?: string } = {}): JSX.Element {
  const {
    state: {
      activeSheetId,
      instances,
      templates,
      itemTemplates,
      itemTemplateOrder,
      localSheetEquipment,
      localSheetActiveWeapon,
      localSheetStatOverrides
    },
    dispatch
  } = useAppStore();
  const [selectedItemTemplateId, setSelectedItemTemplateId] = useState<string>(() => itemTemplateOrder[0] || "");

  useEffect(() => {
    setSelectedItemTemplateId((prev) => {
      if (prev && itemTemplates[prev]) {
        return prev;
      }
      return itemTemplateOrder[0] || "";
    });
  }, [itemTemplateOrder, itemTemplates]);

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
  const activeWeaponId = detail ? localSheetActiveWeapon[detail.instance.id] ?? null : null;
  const activeWeaponName =
    detail && activeWeaponId
      ? (() => {
          const entry = (localSheetEquipment[detail.instance.id] ?? []).find((item) => item.id === activeWeaponId);
          if (!entry) {
            return null;
          }
          return itemTemplates[entry.itemTemplateId]?.name ?? null;
        })()
      : null;

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
              <select
                value={selectedItemTemplateId}
                onChange={(event) => setSelectedItemTemplateId(event.target.value)}
              >
                {itemTemplateOrder.length === 0 ? <option value="">No items created yet</option> : null}
                {itemTemplateOrder.map((itemId) => {
                  const item = itemTemplates[itemId];
                  if (!item) {
                    return null;
                  }
                  return (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.type})
                    </option>
                  );
                })}
              </select>
              <button
                className="button"
                onClick={() => {
                  const item = selectedItemTemplateId ? itemTemplates[selectedItemTemplateId] : null;
                  if (!item) {
                    return;
                  }
                  const entry = { id: makeId("inv"), itemTemplateId: item.id };
                  dispatch({ type: "add_sheet_equipment", sheetId: detail.instance.id, entry });
                  if (!localSheetActiveWeapon[detail.instance.id]) {
                    dispatch({
                      type: "set_sheet_active_weapon",
                      sheetId: detail.instance.id,
                      inventoryItemId: entry.id
                    });
                  }
                }}
              >
                Add
              </button>
            </div>
            <p className="muted">Active weapon: {activeWeaponName ?? "None"}</p>
            <div className="list">
              {(localSheetEquipment[detail.instance.id] ?? []).length === 0 ? (
                <p className="empty-state">No equipment added yet.</p>
              ) : null}
              {(localSheetEquipment[detail.instance.id] ?? []).map((entry) => {
                const item = itemTemplates[entry.itemTemplateId];
                if (!item) {
                  return null;
                }
                return (
                  <article key={entry.id} className="list-item">
                  <div>
                    <strong>{item.name}</strong>
                    {localSheetActiveWeapon[detail.instance.id] === entry.id ? (
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
                          inventoryItemId:
                            localSheetActiveWeapon[detail.instance.id] === entry.id ? null : entry.id
                        })
                      }
                    >
                      {localSheetActiveWeapon[detail.instance.id] === entry.id ? "Clear Active" : "Set Active"}
                    </button>
                    <button
                      className="button button--secondary"
                      onClick={() =>
                        dispatch({
                          type: "remove_sheet_equipment",
                          sheetId: detail.instance.id,
                          inventoryItemId: entry.id
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* TODO: Add editable fields once backend update endpoints are finalized. */}
        </div>
      )}
    </Panel>
  );
}
