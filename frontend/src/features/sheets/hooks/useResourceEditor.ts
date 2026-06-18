import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import type { HealthDamageType } from "@/features/sheets/sheetDisplay";
import { parseModifierInput, type ResourceKey } from "@/features/sheets/sheetDisplay";
import type { GameClient } from "@/hooks/useGameClient";
import { buildAdjustInstancedSheetResourceRequest } from "@/infrastructure/ws/requestBuilders";

interface UseResourceEditorOptions {
  resetToken: string | undefined;
  instanceId: string | undefined;
  baseHealth: number;
  baseMana: number;
  client: Pick<GameClient, "sendProtocolRequest">;
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
  instanceId,
  baseHealth,
  baseMana,
  client
}: UseResourceEditorOptions): UseResourceEditorResult {
  const [editingResource, setEditingResource] = useState<ResourceKey | null>(null);
  const [resourceDraftModifier, setResourceDraftModifier] = useState("");
  const [resourceEditorError, setResourceEditorError] = useState<string | null>(null);
  const [healthDamageType, setHealthDamageType] = useState<HealthDamageType>("untyped");

  useEffect(() => {
    setEditingResource(null);
    setResourceDraftModifier("");
    setResourceEditorError(null);
    setHealthDamageType("untyped");
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

    if (!instanceId) {
      setResourceEditorError("No active sheet instance selected.");
      return;
    }

    client.sendProtocolRequest(
      buildAdjustInstancedSheetResourceRequest({
        instanceId,
        resource: key,
        delta: parsed
      }),
      `Adjust ${key}`
    );

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
    resources: {
      health: baseHealth,
      mana: baseMana
    },
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
