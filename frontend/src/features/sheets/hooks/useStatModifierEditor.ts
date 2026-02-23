import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import type { SheetStatKey } from "@/domain/stats";
import { formatModifier, parseModifierInput } from "@/features/sheets/sheetDisplay";

interface UseStatModifierEditorOptions {
  resetToken: string | undefined;
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

export function useStatModifierEditor({ resetToken }: UseStatModifierEditorOptions): UseStatModifierEditorResult {
  const [modifiers, setModifiers] = useState<Partial<Record<SheetStatKey, number>>>({});
  const [editingKey, setEditingKey] = useState<SheetStatKey | null>(null);
  const [draftModifier, setDraftModifier] = useState("");
  const [editorError, setEditorError] = useState<string | null>(null);

  useEffect(() => {
    setModifiers({});
    setEditingKey(null);
    setDraftModifier("");
    setEditorError(null);
  }, [resetToken]);

  const getModifier = (key: SheetStatKey): number => modifiers[key] ?? 0;

  const getCurrentValue = (key: SheetStatKey, base: number): number => base + getModifier(key);

  const beginEditing = (key: SheetStatKey): void => {
    const currentMod = getModifier(key);
    setEditingKey(key);
    setDraftModifier(currentMod === 0 ? "" : formatModifier(currentMod));
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

    setModifiers((prev) => {
      const next: Partial<Record<SheetStatKey, number>> = { ...prev };
      if (parsed === 0) {
        delete next[key];
      } else {
        next[key] = parsed;
      }
      return next;
    });

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
    setModifiers((prev) => {
      const next: Partial<Record<SheetStatKey, number>> = { ...prev };
      delete next[key];
      return next;
    });

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
