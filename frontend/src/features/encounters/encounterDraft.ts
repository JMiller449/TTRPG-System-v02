import { makeId } from "@/shared/utils/id";

export interface DraftEncounterEntry {
  id: string;
  templateId: string;
  count: number;
}

export function newRosterEntry(templateId = "", count = 1): DraftEncounterEntry {
  return { id: makeId("entry"), templateId, count };
}
