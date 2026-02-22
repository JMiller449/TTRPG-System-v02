import type { AppState } from "@/app/state/types";

export const initialState: AppState = {
  role: null,
  playerConsoleEnteredSheetId: null,
  gmPassword: "",
  gmAuthenticated: false,
  connection: {
    status: "disconnected",
    transport: (import.meta.env.VITE_TRANSPORT === "ws" ? "ws" : "mock") as
      | "mock"
      | "ws"
  },
  gmView: "console",
  templates: {},
  templateOrder: [],
  instances: {},
  instanceOrder: [],
  encounters: {},
  encounterOrder: [],
  rollLog: [],
  activeSheetId: null,
  templateSearch: "",
  pendingIntentIds: [],
  intentFeedback: [],
  localSheetNotes: {},
  localSheetEquipment: {},
  localSheetActiveWeapon: {},
  localSheetStatOverrides: {}
};
