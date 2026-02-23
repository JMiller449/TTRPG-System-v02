import { makeId } from "@/shared/utils/id";

export interface DraftEncounterEntry {
  id: string;
  templateId: string;
  count: number;
}

export function newRosterEntry(): DraftEncounterEntry {
  return { id: makeId("entry"), templateId: "", count: 1 };
}
