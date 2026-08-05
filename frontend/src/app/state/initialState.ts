import type { AppState, ServerState, UIState } from "@/app/state/types";

export const initialServerState: ServerState = {
  role: null,
  gmAuthenticated: false,
  catalogFolders: {},
  catalogFolderOrder: [],
  catalogEntries: {},
  catalogEntryOrder: [],
  sheets: {},
  sheetOrder: [],
  persistentSheets: {},
  persistentSheetOrder: [],
  items: {},
  itemOrder: [],
  itemTemplates: {},
  itemTemplateOrder: [],
  tags: {},
  tagOrder: [],
  proficiencies: {},
  proficiencyOrder: [],
  actions: {},
  actionOrder: [],
  formulas: {},
  formulaOrder: [],
  attributes: {},
  attributeOrder: [],
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
    status: "unknown",
    bindingKey: null,
    bindingLabel: null
  },
  gmView: "sheet_viewer",
  activeSheetId: null,
  templateBuilderSheetId: null,
  templateSearch: "",
  catalogCreationTargets: {},
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
