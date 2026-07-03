import { useContext } from "react";
import { AppDispatchContext, AppStateContext, StoreContext } from "@/app/state/storeContext";

export function useAppState() {
  const state = useContext(AppStateContext);
  const legacyContext = useContext(StoreContext);
  if (state) {
    return state;
  }
  if (legacyContext) {
    return legacyContext.state;
  }
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
