import { useState } from "react";
import type { XpTrackerKillEvent } from "@/generated/backendProtocol";
import { emptyKillFilters, filterKills, type KillFilters } from "./killFilters";

export function useKillFilters(
  kills: readonly XpTrackerKillEvent[],
  scope: string
): {
  filters: KillFilters;
  setFilters: (filters: KillFilters) => void;
  filteredKills: XpTrackerKillEvent[];
} {
  const [draft, setDraft] = useState({ scope, filters: emptyKillFilters });
  // Switching characters starts a fresh view; pushed history updates retain the filters.
  if (draft.scope !== scope) setDraft({ scope, filters: emptyKillFilters });
  const filters = draft.scope === scope ? draft.filters : emptyKillFilters;
  const setFilters = (next: KillFilters): void => setDraft({ scope, filters: next });
  return { filters, setFilters, filteredKills: filterKills(kills, filters) };
}
