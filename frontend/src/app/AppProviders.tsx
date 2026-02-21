import type { ReactNode } from "react";
import { AppStoreProvider } from "@/app/state/store";

export function AppProviders({ children }: { children: ReactNode }): JSX.Element {
  return <AppStoreProvider>{children}</AppStoreProvider>;
}
