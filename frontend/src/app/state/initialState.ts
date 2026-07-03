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
  proficiencies: {},
  proficiencyOrder: [],
  actions: {},
  actionOrder: [],
  formulas: {},
  formulaOrder: [],
  facts: {},
  factOrder: [],
  augmentations: {},
  augmentationOrder: [],
  standaloneEffects: {},
  standaloneEffectOrder: [],
  standaloneEffectApplications: {},
  standaloneEffectApplicationOrder: [],
  conditionPresets: {},
  conditionPresetOrder: [],
  activeConditions: {},
  activeConditionOrder: [],
  encounters: {},
  encounterOrder: [],
  actionHistory: {},
  actionHistoryOrder: []
};

export const initialUiState: UIState = {
  playerSheetSelectionComplete: false,
  connection: {
    status: "disconnected"
  },
  roll20Bridge: {
    status: "unknown"
  },
  gmView: "console",
  activeSheetId: null,
  templateBuilderSheetId: null,
  templateSearch: "",
  pendingIntentIds: [],
  intentFeedback: [],
  actionFormulaAuthoringMetadata: null,
  augmentationTargetMetadata: null,
  xpTracker: null,
  sheetAccessCodes: [],
  stateBackupExport: null
};

export const initialState: AppState = {
  serverState: initialServerState,
  uiState: initialUiState
};
