import type { AppState, ServerState, UIState } from "@/app/state/types";
import { DEFAULT_ITEM_LIBRARY } from "@/features/items/itemLibrarySeed";

const initialItemTemplates = Object.fromEntries(
  DEFAULT_ITEM_LIBRARY.map((item) => [item.id, item])
);

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
  itemTemplates: initialItemTemplates,
  itemTemplateOrder: DEFAULT_ITEM_LIBRARY.map((item) => item.id),
  activeSheetId: null,
  templateSearch: "",
  pendingIntentIds: [],
  intentFeedback: [],
  localSheetNotes: {},
  localSheetEquipment: {},
  localSheetActiveWeapon: {},
  localSheetStatOverrides: {}
};

export const initialState: AppState = {
  serverState: initialServerState,
  uiState: initialUiState
};
