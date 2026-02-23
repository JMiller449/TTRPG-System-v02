import type { ItemTemplate } from "@/domain/models";
import { makeId } from "@/shared/utils/id";

export type ItemEditorValues = {
  name: string;
  type: string;
  rank: string;
  weight: string;
  value: string;
  immediateEffects: string;
  nonImmediateEffects: string;
};

export const ITEM_RANK_OPTIONS = [
  "F",
  "F+",
  "E",
  "E+",
  "D",
  "D+",
  "C",
  "C+",
  "B",
  "B+",
  "A",
  "A+",
  "S",
  "S+",
  "SS",
  "SS+"
] as const;

export function createEmptyItemValues(): ItemEditorValues {
  return {
    name: "",
    type: "",
    rank: ITEM_RANK_OPTIONS[0],
    weight: "",
    value: "",
    immediateEffects: "",
    nonImmediateEffects: ""
  };
}

export function toItemEditorValues(item: ItemTemplate): ItemEditorValues {
  return {
    name: item.name,
    type: item.type,
    rank: item.rank,
    weight: item.weight,
    value: item.value,
    immediateEffects: item.immediateEffects,
    nonImmediateEffects: item.nonImmediateEffects
  };
}

export function toItemTemplate(values: ItemEditorValues, existingId?: string): ItemTemplate {
  return {
    id: existingId ?? makeId("item"),
    name: values.name.trim(),
    type: values.type.trim(),
    rank: values.rank.trim(),
    weight: values.weight.trim(),
    value: values.value.trim(),
    immediateEffects: values.immediateEffects.trim(),
    nonImmediateEffects: values.nonImmediateEffects.trim(),
    updatedAt: new Date().toISOString()
  };
}
