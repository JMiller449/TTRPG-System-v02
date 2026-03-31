import type { AppState } from "@/app/state/types";
import { DEFAULT_ITEM_LIBRARY } from "@/features/items/itemLibrarySeed";

const initialItemTemplates = Object.fromEntries(
  DEFAULT_ITEM_LIBRARY.map((item) => [item.id, item])
);

export const initialState: AppState = {
  role: null,
  playerSheetSelectionComplete: false,
  gmPassword: "",
  gmAuthenticated: false,
  connection: {
    status: "disconnected",
    transport: (import.meta.env.VITE_TRANSPORT === "mock" ? "mock" : "ws") as
      | "mock"
      | "ws"
  },
  gmView: "console",
  sheets: {},
  sheetOrder: [],
  persistentSheets: {},
  persistentSheetOrder: [],
  sheetPresentation: {},
  persistentSheetPresentation: {},
  encounters: {},
  encounterOrder: [],
  itemTemplates: initialItemTemplates,
  itemTemplateOrder: DEFAULT_ITEM_LIBRARY.map((item) => item.id),
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
