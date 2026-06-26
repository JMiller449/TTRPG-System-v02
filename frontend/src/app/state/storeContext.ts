import { createContext } from "react";
import type { Dispatch } from "react";
import type { AppAction, AppState } from "@/app/state/types";

export interface StoreContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

export const StoreContext = createContext<StoreContextValue | null>(null);
