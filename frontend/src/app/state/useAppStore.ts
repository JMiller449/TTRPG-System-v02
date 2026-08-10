import { useContext } from "react";
import { AppDispatchContext, AppStateContext, StoreContext } from "@/app/state/storeContext";

export function useOptionalAppState() {
  const state = useContext(AppStateContext);
  const legacyContext = useContext(StoreContext);
  return state ?? legacyContext?.state ?? null;
}

export function useAppState() {
  const state = useOptionalAppState();
  if (state) return state;
  throw new Error("useAppState must be used inside AppStoreProvider");
}

export function useAppDispatch() {
  const dispatch = useContext(AppDispatchContext);
  const legacyContext = useContext(StoreContext);
  if (dispatch) {
    return dispatch;
  }
  if (legacyContext) {
    return legacyContext.dispatch;
  }
  throw new Error("useAppDispatch must be used inside AppStoreProvider");
}

export function useAppStore() {
  return {
    state: useAppState(),
    dispatch: useAppDispatch()
  };
}
