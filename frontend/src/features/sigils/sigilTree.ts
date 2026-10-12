import type { SigilNodePayload } from "@/generated/backendProtocol";
import { makeId } from "@/shared/utils/id";

export function descendants(nodes: SigilNodePayload[], id: string): Set<string> {
  const result = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (node.parent_id && result.has(node.parent_id) && !result.has(node.id)) {
        result.add(node.id);
        changed = true;
      }
    }
  }
  return result;
}

export function orderedTree(
  nodes: SigilNodePayload[]
): { node: SigilNodePayload; depth: number }[] {
  const result: { node: SigilNodePayload; depth: number }[] = [];
  const stack = nodes
    .filter((node) => !node.parent_id)
    .reverse()
    .map((node) => ({ node, depth: 0 }));
  const seen = new Set<string>();
  while (stack.length) {
    const entry = stack.pop()!;
    if (seen.has(entry.node.id)) continue;
    seen.add(entry.node.id);
    result.push(entry);
    stack.push(
      ...nodes
        .filter((node) => node.parent_id === entry.node.id)
        .reverse()
        .map((node) => ({ node, depth: entry.depth + 1 }))
    );
  }
  return result;
}

export function duplicateBranch(nodes: SigilNodePayload[], id: string): SigilNodePayload[] {
  const branch = descendants(nodes, id);
  const ids = new Map([...branch].map((key) => [key, makeId("sigil_node")]));
  const copies = nodes
    .filter((node) => branch.has(node.id))
    .map((node) => ({
      ...node,
      id: ids.get(node.id)!,
      name: `${node.name} copy`,
      parent_id: ids.get(node.parent_id ?? "") ?? node.parent_id,
      charge: null,
      last_imbuer_instance_id: null
    }));
  return [...nodes, ...copies];
}

export function reorderNode(
  nodes: SigilNodePayload[],
  id: string,
  delta: -1 | 1
): SigilNodePayload[] {
  const index = nodes.findIndex((node) => node.id === id);
  const node = nodes[index];
  const siblings = nodes.filter((candidate) => candidate.parent_id === node.parent_id);
  const target = siblings[siblings.findIndex((candidate) => candidate.id === id) + delta];
  if (!target) return nodes;
  const result = [...nodes];
  const targetIndex = result.findIndex((candidate) => candidate.id === target.id);
  [result[index], result[targetIndex]] = [result[targetIndex], result[index]];
  return result;
}

export function newNode(parentId: string | null): SigilNodePayload {
  return {
    id: makeId("sigil_node"),
    name: parentId ? "Sub-sigil" : "New sigil",
    diameter: 1,
    parent_id: parentId,
    action_id: null,
    mana_cost_step_ids: [],
    power_step_ids: [],
    charge: null,
    last_imbuer_instance_id: null
  };
}
