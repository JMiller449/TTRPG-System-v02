import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { SheetKind } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildCreateSheetFromInstanceRequest,
  buildDeleteInstancedSheetRequest,
  buildGenerateSheetAccessCodeRequest,
  buildGetSheetAccessCodesRequest
} from "@/infrastructure/ws/requestBuilders";
import { Field } from "@/shared/ui/Field";
import { confirmDestructiveAction } from "@/shared/ui/confirmDestructiveAction";
import { deriveSnapshotTemplateId } from "@/features/sheets/snapshotTemplateId";

export function SheetManagementSection({
  client,
  instanceId,
  instanceName,
  parentSheetId,
  kind
}: {
  client: GameClient;
  instanceId: string;
  instanceName: string;
  parentSheetId: string;
  kind: SheetKind;
}): JSX.Element {
  const {
    state: {
      serverState: { sheets },
      uiState: { sheetAccessCodes }
    }
  } = useAppStore();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [snapshotName, setSnapshotName] = useState("");
  const [reservedSnapshotIds, setReservedSnapshotIds] = useState<Set<string>>(() => new Set());

  const activeCode = useMemo(
    () => sheetAccessCodes.find((entry) => entry.active && entry.instanceId === instanceId) ?? null,
    [instanceId, sheetAccessCodes]
  );

  useEffect(() => {
    if (kind === "player") {
      client.sendProtocolRequest(buildGetSheetAccessCodesRequest(), "Load player access code");
    }
  }, [client, kind]);

  useEffect(() => {
    setCopiedCode(null);
    setSnapshotName(`${instanceName} Snapshot`);
    setReservedSnapshotIds(new Set());
  }, [instanceId, instanceName]);

  const generateAccessCode = (): void => {
    if (
      activeCode &&
      !confirmDestructiveAction({
        action: "Rotate",
        subject: `${instanceName} access code`,
        consequence:
          "The current code will stop working for future logins. Existing connected sessions are not signed out."
      })
    ) {
      return;
    }

    client.sendProtocolRequest(
      buildGenerateSheetAccessCodeRequest({
        sheetId: parentSheetId,
        instanceId
      }),
      `${activeCode ? "Rotate" : "Generate"} access code: ${instanceName}`
    );
  };

  const copyAccessCode = async (): Promise<void> => {
    if (!activeCode) {
      return;
    }
    await navigator.clipboard.writeText(activeCode.code);
    setCopiedCode(activeCode.code);
  };

  const createSnapshot = (): void => {
    const nextName = snapshotName.trim();
    if (!nextName) {
      return;
    }
    const nextId = deriveSnapshotTemplateId(nextName, [
      ...Object.keys(sheets),
      ...reservedSnapshotIds
    ]);
    client.sendProtocolRequest(
      buildCreateSheetFromInstanceRequest({
        instanceId,
        sheetId: nextId,
        name: nextName
      }),
      `Snapshot template: ${nextName}`
    );
    setReservedSnapshotIds((current) => new Set(current).add(nextId));
  };

  const despawn = (): void => {
    if (
      !confirmDestructiveAction({
        action: "Despawn",
        subject: instanceName,
        consequence:
          "This permanently removes the spawned character and its current inventory, assignments, access code, and runtime state."
      })
    ) {
      return;
    }
    client.sendProtocolRequest(
      buildDeleteInstancedSheetRequest({ instanceId }),
      `Despawn ${instanceName}`
    );
  };

  return (
    <div className="sheet-management stack">
      <header className="sheet-detail-page__header">
        <div>
          <span>Character administration</span>
          <h3>Management</h3>
        </div>
        <p className="muted">
          Manage player access, preserve this character as a template, or remove the spawned
          character.
        </p>
      </header>

      <section className="sheet-management__section" aria-labelledby="player-access-title">
        <div className="sheet-management__section-copy">
          <h4 id="player-access-title">Player Access</h4>
          {kind === "player" ? (
            <p className="muted">
              Give this code to the player who should claim {instanceName}. Rotating it invalidates
              the previous code for future logins.
            </p>
          ) : (
            <p className="muted">Enemy sheets are GM-only and do not need player access codes.</p>
          )}
        </div>
        {kind === "player" ? (
          <div className="sheet-management__access-controls">
            <div className="sheet-management__code" aria-live="polite">
              <span>Active code</span>
              <strong>{activeCode?.code ?? "Not generated"}</strong>
            </div>
            {activeCode ? (
              <button
                type="button"
                className="button button--secondary"
                onClick={() => void copyAccessCode()}
              >
                {copiedCode === activeCode.code ? "Copied" : "Copy Code"}
              </button>
            ) : null}
            <button type="button" className="button" onClick={generateAccessCode}>
              {activeCode ? "Rotate Code" : "Generate Code"}
            </button>
          </div>
        ) : null}
      </section>

      <section className="sheet-management__section" aria-labelledby="snapshot-title">
        <div className="sheet-management__section-copy">
          <h4 id="snapshot-title">Snapshot as Template</h4>
          <p className="muted">
            Save this spawned character as a new template checkpoint. Current health, mana, and
            active runtime effects are not copied.
          </p>
        </div>
        <div className="sheet-management__snapshot-fields">
          <Field label="Template Name">
            <input
              value={snapshotName}
              onChange={(event) => setSnapshotName(event.target.value)}
              placeholder="Checkpoint name"
            />
          </Field>
          <button
            type="button"
            className="button"
            disabled={!snapshotName.trim()}
            onClick={createSnapshot}
          >
            Create Template Snapshot
          </button>
        </div>
      </section>

      <section
        className="sheet-management__section sheet-management__section--danger"
        aria-labelledby="danger-zone-title"
      >
        <div className="sheet-management__section-copy">
          <h4 id="danger-zone-title">Danger Zone</h4>
          <p className="muted">
            Despawning permanently removes this character and its instance-owned state.
          </p>
        </div>
        <button type="button" className="button button--danger" onClick={despawn}>
          Despawn {instanceName}
        </button>
      </section>
    </div>
  );
}
