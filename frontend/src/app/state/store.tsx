import { createContext, useContext, useMemo, useReducer } from "react";
import type { Dispatch, ReactNode } from "react";
import { initialState } from "@/app/state/initialState";
import { reducer } from "@/app/state/reducer";
import type { AppAction, AppState } from "@/app/state/types";

interface StoreContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore(): StoreContextValue {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useAppStore must be used inside AppStoreProvider");
  }
  return context;
}
