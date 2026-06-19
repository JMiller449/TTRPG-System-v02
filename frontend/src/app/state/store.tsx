import { useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import { initialState } from "@/app/state/initialState";
import { reducer } from "@/app/state/reducer";
import { StoreContext } from "@/app/state/storeContext";

export function AppStoreProvider({ children }: { children: ReactNode }): JSX.Element {
  const [state, dispatch] = useReducer(reducer, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
