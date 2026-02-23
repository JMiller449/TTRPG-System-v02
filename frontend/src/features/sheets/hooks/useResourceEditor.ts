import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import type { HealthDamageType } from "@/features/sheets/sheetDisplay";
import { parseModifierInput, type ResourceKey } from "@/features/sheets/sheetDisplay";

interface UseResourceEditorOptions {
  resetToken: string | undefined;
  baseHealth: number;
  baseMana: number;
}

interface UseResourceEditorResult {
  resources: Record<ResourceKey, number>;
  editingResource: ResourceKey | null;
  resourceDraftModifier: string;
  resourceEditorError: string | null;
  healthDamageType: HealthDamageType;
  setResourceDraftModifier: (value: string) => void;
  setHealthDamageType: (value: HealthDamageType) => void;
  beginResourceEdit: (key: ResourceKey) => void;
  cancelResourceEdit: () => void;
  applyResourceModifier: (key: ResourceKey) => void;
  onResourceEditorKeyDown: (event: KeyboardEvent<HTMLInputElement>, key: ResourceKey) => void;
}

export function useResourceEditor({
  resetToken,
  baseHealth,
  baseMana
}: UseResourceEditorOptions): UseResourceEditorResult {
  const [resources, setResources] = useState<Record<ResourceKey, number>>({
    health: baseHealth,
    mana: baseMana
  });
  const [editingResource, setEditingResource] = useState<ResourceKey | null>(null);
  const [resourceDraftModifier, setResourceDraftModifier] = useState("");
  const [resourceEditorError, setResourceEditorError] = useState<string | null>(null);
  const [healthDamageType, setHealthDamageType] = useState<HealthDamageType>("untyped");

  useEffect(() => {
    setEditingResource(null);
    setResourceDraftModifier("");
    setResourceEditorError(null);
    setHealthDamageType("untyped");
    setResources({
      health: baseHealth,
      mana: baseMana
    });
  }, [baseHealth, baseMana, resetToken]);

  const beginResourceEdit = (key: ResourceKey): void => {
    setEditingResource(key);
    setResourceDraftModifier("");
    setResourceEditorError(null);
  };

  const cancelResourceEdit = (): void => {
    setEditingResource(null);
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

    cancelResourceEdit();
  };

  const onResourceEditorKeyDown = (event: KeyboardEvent<HTMLInputElement>, key: ResourceKey): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyResourceModifier(key);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelResourceEdit();
    }
  };

  return {
    resources,
    editingResource,
    resourceDraftModifier,
    resourceEditorError,
    healthDamageType,
    setResourceDraftModifier,
    setHealthDamageType,
    beginResourceEdit,
    cancelResourceEdit,
    applyResourceModifier,
    onResourceEditorKeyDown
  };
}
