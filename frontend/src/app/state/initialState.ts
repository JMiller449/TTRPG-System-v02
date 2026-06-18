import type { AppState, ServerState, UIState } from "@/app/state/types";

export const initialServerState: ServerState = {
  role: null,
  gmAuthenticated: false,
  sheets: {},
  sheetOrder: [],
  persistentSheets: {},
  persistentSheetOrder: [],
  items: {},
  itemOrder: [],
  actions: {},
  actionOrder: [],
  formulas: {},
  formulaOrder: [],
  sheetPresentation: {},
  persistentSheetPresentation: {},
  encounters: {},
  encounterOrder: []
};

export const initialUiState: UIState = {
  playerSheetSelectionComplete: false,
  connection: {
    status: "disconnected",
    transport: (import.meta.env.VITE_TRANSPORT === "mock" ? "mock" : "ws") as
      | "mock"
      | "ws"
  },
  gmView: "console",
  activeSheetId: null,
  templateSearch: "",
  pendingIntentIds: [],
  intentFeedback: [],
  actionFormulaAuthoringMetadata: null,
  localSheetNotes: {},
  localSheetStatOverrides: {}
};

export const initialState: AppState = {
  serverState: initialServerState,
  uiState: initialUiState
};
