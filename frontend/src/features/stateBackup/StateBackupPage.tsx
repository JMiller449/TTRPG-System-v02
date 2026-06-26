import { useRef, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import {
  buildExportStateBackupRequest,
  buildImportStateBackupRequest
} from "@/infrastructure/ws/requestBuilders";
import { Panel } from "@/shared/ui/Panel";

function downloadJson(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function backupFilename(): string {
  return `ttrpg-state-backup-${new Date().toISOString().slice(0, 10)}.json`;
}

export function StateBackupPage({ client }: { client: GameClient }): JSX.Element {
  const {
    state: {
      uiState: { stateBackupExport }
    }
  } = useAppStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importJson, setImportJson] = useState("");

  const exportedJson = stateBackupExport?.persisted_state_json ?? "";

  const requestExport = (): void => {
    client.sendProtocolRequest(buildExportStateBackupRequest(), "Export state backup");
  };

  const requestImport = (): void => {
    const trimmed = importJson.trim();
    if (!trimmed) {
      return;
    }
    client.sendProtocolRequest(
      buildImportStateBackupRequest({ persistedStateJson: trimmed }),
      "Import state backup"
    );
  };

  return (
    <Panel title="State Backup">
      <div className="stack">
        <p className="muted">
          Export and import the backend persisted-state envelope. Backups include private GM-only state, including
          sheet access codes, so keep exported files somewhere safe.
        </p>

        <section className="stack" aria-labelledby="state-backup-export-title">
          <h3 id="state-backup-export-title">Export</h3>
          <div className="inline-group">
            <button className="button" onClick={requestExport}>
              Export Current State
            </button>
            <button
              className="button button--secondary"
              disabled={!exportedJson}
              onClick={() => {
                if (exportedJson) {
                  downloadJson(backupFilename(), exportedJson);
                }
              }}
            >
              Download Last Export
            </button>
          </div>
          <label className="field">
            <span>Last exported JSON</span>
            <textarea
              readOnly
              rows={12}
              value={exportedJson}
              placeholder="Exported backup JSON will appear here."
            />
          </label>
          {stateBackupExport ? (
            <p className="muted">Schema version: {stateBackupExport.schema_version}</p>
          ) : null}
        </section>

        <section className="stack" aria-labelledby="state-backup-import-title">
          <h3 id="state-backup-import-title">Import</h3>
          <p className="muted">
            Import replaces the entire backend state, clears patch replay history, and forces connected clients to
            resync from full snapshots.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) {
                return;
              }
              void file.text().then(setImportJson);
              event.currentTarget.value = "";
            }}
          />
          <label className="field">
            <span>Backup JSON to import</span>
            <textarea
              rows={12}
              value={importJson}
              onChange={(event) => setImportJson(event.target.value)}
              placeholder="Paste a backend persisted-state backup JSON envelope here."
            />
          </label>
          <div className="inline-group">
            <button className="button button--secondary" onClick={() => fileInputRef.current?.click()}>
              Choose JSON File
            </button>
            <button className="button button--secondary" disabled={!importJson.trim()} onClick={requestImport}>
              Import And Replace State
            </button>
          </div>
        </section>
      </div>
    </Panel>
  );
}
