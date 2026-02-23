import type { AppAction, AppState } from "@/app/state/types";
import { connectionReducer } from "@/app/state/reducer/connectionReducer";
import { intentReducer } from "@/app/state/reducer/intentReducer";
import { itemReducer } from "@/app/state/reducer/itemReducer";
import { sheetLocalReducer } from "@/app/state/reducer/sheetLocalReducer";
import { syncReducer } from "@/app/state/reducer/syncReducer";
import { uiReducer } from "@/app/state/reducer/uiReducer";

type DomainReducer = (state: AppState, action: AppAction) => AppState | undefined;

const DOMAIN_REDUCERS: readonly DomainReducer[] = [
  uiReducer,
  connectionReducer,
  intentReducer,
  itemReducer,
  sheetLocalReducer,
  syncReducer
];

export function reducer(state: AppState, action: AppAction): AppState {
  for (const domainReducer of DOMAIN_REDUCERS) {
    const next = domainReducer(state, action);
    if (next) {
      return next;
    }
  }

  return state;
}
