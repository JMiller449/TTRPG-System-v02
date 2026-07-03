import { useReducer } from "react";
import type { ReactNode } from "react";
import { initialState } from "@/app/state/initialState";
import { reducer } from "@/app/state/reducer";
import { AppDispatchContext, AppStateContext } from "@/app/state/storeContext";

export function AppStoreProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <AppDispatchContext.Provider value={dispatch}>
      <AppStateContext.Provider value={state}>{children}</AppStateContext.Provider>
    </AppDispatchContext.Provider>
  );
}
