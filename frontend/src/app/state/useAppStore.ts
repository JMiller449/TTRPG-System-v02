import { useContext } from "react";
import { StoreContext } from "@/app/state/storeContext";

export function useAppStore() {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error("useAppStore must be used inside AppStoreProvider");
  }
  return context;
}
