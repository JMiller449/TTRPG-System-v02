export function upsert<T extends { id: string }>(
  map: Record<string, T>,
  order: string[],
  value: T
): { map: Record<string, T>; order: string[] } {
  const nextMap = { ...map, [value.id]: value };
  const exists = order.includes(value.id);
  return {
    map: nextMap,
    order: exists ? order : [...order, value.id]
  };
}

export function removeById<T>(
  map: Record<string, T>,
  order: string[],
  id: string
): { map: Record<string, T>; order: string[] } {
  const nextMap = { ...map };
  delete nextMap[id];
  return {
    map: nextMap,
    order: order.filter((entryId) => entryId !== id)
  };
}
