import { createContext } from "react";
import type { Dispatch } from "react";
import type { AppAction, AppState } from "@/app/state/types";

export interface StoreContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

export const AppStateContext = createContext<AppState | null>(null);
export const AppDispatchContext = createContext<Dispatch<AppAction> | null>(null);
export const StoreContext = createContext<StoreContextValue | null>(null);
