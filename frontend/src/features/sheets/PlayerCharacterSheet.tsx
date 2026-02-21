import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { useAppStore } from "@/app/state/store";
import type { GameClient } from "@/hooks/useGameClient";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Panel } from "@/shared/ui/Panel";
import { makeId } from "@/shared/utils/id";

const CORE_SUBSTAT_GROUPS = [
  { core: "strength", subs: ["lifting", "carry_weight"] },
  { core: "dexterity", subs: ["acrobatics", "stamina", "reaction_time"] },
  { core: "constitution", subs: ["health", "endurance", "pain_tolerance"] },
  { core: "perception", subs: ["sight_distance", "intuition", "registration"] },
  { core: "arcane", subs: ["mana", "control", "sensitivity"] },
  { core: "will", subs: ["charisma", "mental_fortitude", "courage"] }
] as const;

type CoreStatKey = (typeof CORE_SUBSTAT_GROUPS)[number]["core"];
type SubStatKey = (typeof CORE_SUBSTAT_GROUPS)[number]["subs"][number];
type SheetStatKey = CoreStatKey | SubStatKey;
type ResourceKey = "health" | "mana";

const RESOURCE_KEYS: readonly ResourceKey[] = ["health", "mana"];

const DISPLAY_NAMES: Record<string, string> = {
  strength: "Strength",
  dexterity: "Dexterity",
  constitution: "Constitution",
  perception: "Perception",
  arcane: "Arcane",
  will: "Will",
  lifting: "Lifting",
  carry_weight: "Carry Weight",
  acrobatics: "Acrobatics",
  stamina: "Stamina",
  reaction_time: "Reaction Time",
  health: "Health",
  endurance: "Endurance",
  pain_tolerance: "Pain Tolerance",
  sight_distance: "Sight Distance",
  intuition: "Intuition",
  registration: "Registration",
  mana: "Mana",
  control: "Control",
  sensitivity: "Sensitivity",
  charisma: "Charisma",
  mental_fortitude: "Mental Fortitude",
  courage: "Courage"
};

function parseModifierInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return 0;
  }
  if (!/^[+-]?\d+$/.test(trimmed)) {
    return null;
  }
  return Number(trimmed);
}

function formatModifier(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}

function isResourceKey(value: string): value is ResourceKey {
  return RESOURCE_KEYS.includes(value as ResourceKey);
}

export function PlayerCharacterSheet({
  client,
  mode = "player",
  panelTitle
}: {
  client: GameClient;
  mode?: "player" | "gm";
  panelTitle?: string;
}): JSX.Element {
  const {
    state: {
      activeSheetId,
      instances,
      templates,
      localSheetNotes,
      localSheetEquipment,
      localSheetActiveWeapon,
      localSheetStatOverrides
    },
    dispatch
  } = useAppStore();

  const [modifiers, setModifiers] = useState<Partial<Record<SheetStatKey, number>>>({});
  const [editingKey, setEditingKey] = useState<SheetStatKey | null>(null);
  const [draftModifier, setDraftModifier] = useState("");
  const [editorError, setEditorError] = useState<string | null>(null);
  const [resources, setResources] = useState<Record<ResourceKey, number>>({ health: 0, mana: 0 });
  const [editingResource, setEditingResource] = useState<ResourceKey | null>(null);
  const [resourceDraftModifier, setResourceDraftModifier] = useState("");
  const [resourceEditorError, setResourceEditorError] = useState<string | null>(null);
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

  useEffect(() => {
    setModifiers({});
    setEditingKey(null);
    setDraftModifier("");
    setEditorError(null);
    setEditingResource(null);
    setResourceDraftModifier("");
    setResourceEditorError(null);
    setResources({
      health: detail?.stats.health ?? 0,
      mana: detail?.stats.mana ?? 0
    });
  }, [detail?.instance.id, detail?.template?.updatedAt, detail?.stats.health, detail?.stats.mana]);

  const getModifier = (key: SheetStatKey): number => modifiers[key] ?? 0;

  const getCurrentValue = (key: SheetStatKey, base: number): number => base + getModifier(key);

  const beginEditing = (key: SheetStatKey): void => {
    const currentMod = getModifier(key);
    setEditingKey(key);
    setDraftModifier(currentMod === 0 ? "" : formatModifier(currentMod));
    setEditorError(null);
  };

  const applyModifier = (key: SheetStatKey): void => {
    const parsed = parseModifierInput(draftModifier);
    if (parsed === null) {
      setEditorError("Enter a whole-number modifier like +10, -10, or 0.");
      return;
    }

    setModifiers((prev) => {
      const next: Partial<Record<SheetStatKey, number>> = { ...prev };
      if (parsed === 0) {
        delete next[key];
      } else {
        next[key] = parsed;
      }
      return next;
    });

    // TODO: Persist stat modifiers via backend intent when update API is available.
    setEditingKey(null);
    setDraftModifier("");
    setEditorError(null);
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLInputElement>, key: SheetStatKey): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyModifier(key);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setEditingKey(null);
      setDraftModifier("");
      setEditorError(null);
    }
  };

  const resetModifier = (key: SheetStatKey): void => {
    setModifiers((prev) => {
      const next: Partial<Record<SheetStatKey, number>> = { ...prev };
      delete next[key];
      return next;
    });

    if (editingKey === key) {
      setEditingKey(null);
      setDraftModifier("");
      setEditorError(null);
    }
  };

  const beginResourceEdit = (key: ResourceKey): void => {
    setEditingResource(key);
    setResourceDraftModifier("");
    setResourceEditorError(null);
  };

  const applyResourceModifier = (key: ResourceKey): void => {
    const parsed = parseModifierInput(resourceDraftModifier);
    if (parsed === null) {
      setResourceEditorError("Enter a whole-number modifier like +10, -10, or 0.");
      return;
    }
    setResources((prev) => ({
      ...prev,
      [key]: prev[key] + parsed
    }));

    // TODO: Persist Health/Mana runtime resource changes via backend intent once API exists.
    setEditingResource(null);
    setResourceDraftModifier("");
    setResourceEditorError(null);
  };

  const handleResourceEditorKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    key: ResourceKey
  ): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyResourceModifier(key);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setEditingResource(null);
      setResourceDraftModifier("");
      setResourceEditorError(null);
    }
  };

  if (!detail) {
    return (
      <Panel title="Character Sheet">
        <EmptyState message="No active sheet selected." />
      </Panel>
    );
  }

  const runtimeNote = localSheetNotes[detail.instance.id] ?? detail.instance.notes ?? "";
  const equipment = localSheetEquipment[detail.instance.id] ?? [];
  const activeWeapon = localSheetActiveWeapon[detail.instance.id] ?? null;
  const activeWeaponLabel = activeWeapon ?? "None";

  return (
    <Panel
      title={panelTitle ?? (mode === "gm" ? "Sheet Detail" : "Character Sheet")}
      actions={
        mode === "player" ? (
          <button
            className="button button--secondary"
            onClick={() =>
              client.sendIntent({
                intentId: makeId("intent"),
                type: "set_active_sheet",
                payload: { sheetId: null }
              })
            }
          >
            Change Player
          </button>
        ) : null
      }
    >
      <p className="character-sheet__panel-subtext muted">
        Sheet ID: {detail.instance.id} · Updated: {new Date(detail.instance.updatedAt).toLocaleDateString()}
      </p>
      <article className="character-sheet">
        <header className="character-sheet__header">
          <div className="character-sheet__header-main">
            <h3>{detail.instance.name}</h3>
          </div>
          <div className="character-sheet__header-right">
            <div className="resource-grid resource-grid--header">
              {RESOURCE_KEYS.map((key) => {
                const baseValue = detail.stats[key] ?? 0;
                const currentValue = resources[key];
                const delta = currentValue - baseValue;
                return (
                  <article key={key} className="resource-card">
                    <div className="resource-card__top">
                      <span className="resource-card__label">{DISPLAY_NAMES[key]}</span>
                      <button className="resource-card__value-btn" onClick={() => beginResourceEdit(key)}>
                        <strong
                          className={`resource-card__value ${
                            delta > 0 ? "stat-value--up" : delta < 0 ? "stat-value--down" : ""
                          }`}
                        >
                          {currentValue}/{baseValue}
                        </strong>
                      </button>
                    </div>
                    {delta !== 0 ? (
                      <div className="resource-card__delta-row">
                        <span className={`stat-modifier ${delta > 0 ? "stat-modifier--up" : "stat-modifier--down"}`}>
                          {formatModifier(delta)}
                        </span>
                      </div>
                    ) : null}

                    {editingResource === key ? (
                      <div className="stat-editor">
                        <input
                          value={resourceDraftModifier}
                          onChange={(event) => setResourceDraftModifier(event.target.value)}
                          onKeyDown={(event) => handleResourceEditorKeyDown(event, key)}
                          inputMode="numeric"
                          placeholder="+10 or -10"
                          aria-label={`${DISPLAY_NAMES[key]} resource modifier`}
                          autoFocus
                        />
                        <button className="button" onClick={() => applyResourceModifier(key)}>
                          Apply
                        </button>
                        <button
                          className="button button--secondary"
                          onClick={() => {
                            setEditingResource(null);
                            setResourceDraftModifier("");
                            setResourceEditorError(null);
                          }}
                        >
                          Cancel
                        </button>
                        {resourceEditorError ? (
                          <p className="error-text stat-editor__error">{resourceEditorError}</p>
                        ) : (
                          <p className="muted stat-editor__hint">Updates active value only.</p>
                        )}
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </header>

        <section className="character-sheet__section">
          <h4>Core Stats and Related Substats</h4>
          <p className="muted character-sheet__hint">
            Click any editable value to apply a modifier. Press Enter to apply, or Esc to cancel.
          </p>
          <div className="character-sheet__core-blocks">
            {CORE_SUBSTAT_GROUPS.map((group) => {
              const key = group.core;
              const baseValue = detail.stats[key] ?? 0;
              const modifier = getModifier(key);
              const currentValue = getCurrentValue(key, baseValue);
              return (
                <section key={key} className="core-block">
                  <header className="core-block__header">
                    <div>
                      <span className="core-block__label">{DISPLAY_NAMES[key]}</span>
                    </div>
                    <div className="core-block__value-wrap">
                      <button className="core-block__value-button" onClick={() => beginEditing(key)}>
                        <strong
                          className={`core-block__value ${
                            modifier > 0 ? "stat-value--up" : modifier < 0 ? "stat-value--down" : ""
                          }`}
                        >
                          {currentValue}
                        </strong>
                      </button>
                      <div className="core-block__actions">
                        {modifier !== 0 ? (
                          <>
                            <span
                              className={`stat-modifier ${modifier > 0 ? "stat-modifier--up" : "stat-modifier--down"}`}
                            >
                              {formatModifier(modifier)}
                            </span>
                            <button className="link-button" onClick={() => resetModifier(key)}>
                              Reset
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </header>

                  {editingKey === key ? (
                    <div className="stat-editor">
                      <input
                        value={draftModifier}
                        onChange={(event) => setDraftModifier(event.target.value)}
                        onKeyDown={(event) => handleEditorKeyDown(event, key)}
                        inputMode="numeric"
                        placeholder="+10 or -10"
                        aria-label={`${DISPLAY_NAMES[key]} modifier`}
                        autoFocus
                      />
                      <button className="button" onClick={() => applyModifier(key)}>
                        Apply
                      </button>
                      <button
                        className="button button--secondary"
                        onClick={() => {
                          setEditingKey(null);
                          setDraftModifier("");
                          setEditorError(null);
                        }}
                      >
                        Cancel
                      </button>
                      {editorError ? <p className="error-text stat-editor__error">{editorError}</p> : null}
                      {!editorError ? (
                        <p className="muted stat-editor__hint">Modifier only; base value remains from template.</p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="core-block__subs">
                    {group.subs.map((subKey) => {
                      const subBase = detail.stats[subKey] ?? 0;
                      if (isResourceKey(subKey)) {
                        return (
                          <div key={subKey} className="core-sub-row core-sub-row--base-only">
                            <div className="core-sub-row__top">
                              <div className="core-sub-row__main core-sub-row__main--static">
                                <span className="core-sub-row__label">{DISPLAY_NAMES[subKey]}</span>
                                <span className="core-sub-row__value">{subBase}</span>
                              </div>
                              <div className="core-sub-row__actions core-sub-row__actions--placeholder" />
                            </div>
                          </div>
                        );
                      }

                      const subModifier = getModifier(subKey);
                      const subCurrent = getCurrentValue(subKey, subBase);
                      return (
                        <div key={subKey} className="core-sub-row">
                          <div className="core-sub-row__top">
                            <button className="core-sub-row__main" onClick={() => beginEditing(subKey)}>
                              <span className="core-sub-row__label">{DISPLAY_NAMES[subKey]}</span>
                              <span
                                className={`core-sub-row__value ${
                                  subModifier > 0 ? "stat-value--up" : subModifier < 0 ? "stat-value--down" : ""
                                }`}
                              >
                                {subCurrent}
                              </span>
                            </button>
                            <div className="core-sub-row__actions">
                              {subModifier !== 0 ? (
                                <>
                                  <span
                                    className={`stat-modifier ${
                                      subModifier > 0 ? "stat-modifier--up" : "stat-modifier--down"
                                    }`}
                                  >
                                    {formatModifier(subModifier)}
                                  </span>
                                  <button className="link-button" onClick={() => resetModifier(subKey)}>
                                    Reset
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </div>

                          {editingKey === subKey ? (
                            <div className="stat-editor stat-editor--sub">
                              <input
                                value={draftModifier}
                                onChange={(event) => setDraftModifier(event.target.value)}
                                onKeyDown={(event) => handleEditorKeyDown(event, subKey)}
                                inputMode="numeric"
                                placeholder="+10 or -10"
                                aria-label={`${DISPLAY_NAMES[subKey]} modifier`}
                                autoFocus
                              />
                              <button className="button" onClick={() => applyModifier(subKey)}>
                                Apply
                              </button>
                              <button
                                className="button button--secondary"
                                onClick={() => {
                                  setEditingKey(null);
                                  setDraftModifier("");
                                  setEditorError(null);
                                }}
                              >
                                Cancel
                              </button>
                              {editorError ? <p className="error-text stat-editor__error">{editorError}</p> : null}
                              {!editorError ? (
                                <p className="muted stat-editor__hint">
                                  Modifier only; base value remains from template.
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
          <p className="muted">Modified stats can be reset back to base.</p>
        </section>

        <section className="character-sheet__section">
          <h4>Notes</h4>
          <textarea
            value={runtimeNote}
            onChange={(event) =>
              dispatch({
                type: "set_sheet_note",
                sheetId: detail.instance.id,
                note: event.target.value
              })
            }
            rows={5}
            placeholder="Write quick player notes here..."
          />
          <p className="muted">Quick notes are local scaffold state until backend note persistence is finalized.</p>
        </section>

        <section className="character-sheet__section">
          <h4>Equipment</h4>
          <p className="muted">Inventory list only. No slot system is applied in frontend.</p>
          <div className="equipment-add-row">
            <input
              value={equipmentDraft}
              onChange={(event) => setEquipmentDraft(event.target.value)}
              placeholder="e.g. Iron Sword"
            />
            <button
              className="button"
              onClick={() => {
                const value = equipmentDraft.trim();
                if (!value) {
                  return;
                }
                dispatch({ type: "add_sheet_equipment", sheetId: detail.instance.id, item: value });
                if (!activeWeapon) {
                  dispatch({ type: "set_sheet_active_weapon", sheetId: detail.instance.id, item: value });
                }
                setEquipmentDraft("");
              }}
            >
              Add
            </button>
          </div>
          <p className="muted">Active Weapon: {activeWeaponLabel}</p>
          <div className="list">
            {equipment.length === 0 ? <p className="empty-state">No equipment added yet.</p> : null}
            {equipment.map((item, index) => (
              <article key={`${item}_${index}`} className="list-item">
                <div>
                  <strong>{item}</strong>
                  {activeWeapon === item ? <div className="muted">Active weapon</div> : null}
                </div>
                <div className="inline-actions">
                  <button
                    className="button button--secondary"
                    onClick={() =>
                      dispatch({
                        type: "set_sheet_active_weapon",
                        sheetId: detail.instance.id,
                        item: activeWeapon === item ? null : item
                      })
                    }
                  >
                    {activeWeapon === item ? "Clear Active" : "Set Active"}
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
        </section>
      </article>
    </Panel>
  );
}
