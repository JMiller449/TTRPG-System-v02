import type { AppState } from "@/app/state/types";
import { DEFAULT_ITEM_LIBRARY } from "@/features/items/itemLibrarySeed";

const initialItemTemplates = Object.fromEntries(
  DEFAULT_ITEM_LIBRARY.map((item) => [item.id, item])
);

export const initialState: AppState = {
  role: null,
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
