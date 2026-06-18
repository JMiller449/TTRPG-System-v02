import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import type { SheetStatKey } from "@/domain/stats";
import {
  isCoreStatKey,
  parseModifierInput
} from "@/features/sheets/sheetDisplay";
import type { GameClient } from "@/hooks/useGameClient";
import { buildSetSheetBaseStatRequest } from "@/infrastructure/ws/requestBuilders";

interface UseStatModifierEditorOptions {
  resetToken: string | undefined;
  sheetId: string | undefined;
  baseStats: Partial<Record<SheetStatKey, number>>;
  client: Pick<GameClient, "sendProtocolRequest">;
}

interface UseStatModifierEditorResult {
  editingKey: SheetStatKey | null;
  draftModifier: string;
  editorError: string | null;
  setDraftModifier: (value: string) => void;
  getModifier: (key: SheetStatKey) => number;
  getCurrentValue: (key: SheetStatKey, base: number) => number;
  beginEditing: (key: SheetStatKey) => void;
  cancelEditing: () => void;
  applyModifier: (key: SheetStatKey) => void;
  resetModifier: (key: SheetStatKey) => void;
  onEditorKeyDown: (event: KeyboardEvent<HTMLInputElement>, key: SheetStatKey) => void;
}

export function useStatModifierEditor({
  resetToken,
  sheetId,
  baseStats,
  client
}: UseStatModifierEditorOptions): UseStatModifierEditorResult {
  const [editingKey, setEditingKey] = useState<SheetStatKey | null>(null);
  const [draftModifier, setDraftModifier] = useState("");
  const [editorError, setEditorError] = useState<string | null>(null);

  useEffect(() => {
    setEditingKey(null);
    setDraftModifier("");
    setEditorError(null);
  }, [resetToken]);

  const getModifier = (_key: SheetStatKey): number => 0;

  const getCurrentValue = (_key: SheetStatKey, base: number): number => base;

  const beginEditing = (key: SheetStatKey): void => {
    if (!isCoreStatKey(key)) {
      setEditorError("Formula stats are read-only here.");
      return;
    }
    setEditingKey(key);
    setDraftModifier("");
    setEditorError(null);
  };

  const cancelEditing = (): void => {
    setEditingKey(null);
    setDraftModifier("");
    setEditorError(null);
  };

  const applyModifier = (key: SheetStatKey): void => {
    const parsed = parseModifierInput(draftModifier);
    if (parsed === null) {
      setEditorError("Enter a whole-number modifier like +10, -10, or 0.");
      return;
    }

    if (!isCoreStatKey(key)) {
      setEditorError("Formula stats are read-only here.");
      return;
    }

    if (!sheetId) {
      setEditorError("No parent sheet selected for stat editing.");
      return;
    }

    const baseValue = baseStats[key];
    if (typeof baseValue !== "number" || !Number.isFinite(baseValue)) {
      setEditorError("Current stat value is unavailable.");
      return;
    }

    client.sendProtocolRequest(
      buildSetSheetBaseStatRequest({
        sheetId,
        statName: key,
        value: baseValue + parsed
      }),
      `Update ${key}`
    );

    cancelEditing();
  };

  const onEditorKeyDown = (event: KeyboardEvent<HTMLInputElement>, key: SheetStatKey): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyModifier(key);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  };

  const resetModifier = (key: SheetStatKey): void => {
    if (editingKey === key) {
      cancelEditing();
    }
  };

  return {
    editingKey,
    draftModifier,
    editorError,
    setDraftModifier,
    getModifier,
    getCurrentValue,
    beginEditing,
    cancelEditing,
    applyModifier,
    resetModifier,
    onEditorKeyDown
  };
}
