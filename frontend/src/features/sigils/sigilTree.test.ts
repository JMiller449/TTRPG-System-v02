import { describe, expect, it } from "vitest";
import type { SigilNodePayload } from "@/generated/backendProtocol";
import { descendants, duplicateBranch, orderedTree, reorderNode } from "./sigilTree";

const nodes: SigilNodePayload[] = [
  { id: "root", name: "Root", diameter: 1 },
  {
    id: "a",
    name: "A",
    diameter: 2,
    parent_id: "root",
    action_id: "spell",
    charge: {
      action_id: "spell",
      imbuer_instance_id: "mage",
      action_signature: "sig",
      mana_paid: 4
    }
  },
  { id: "b", name: "B", diameter: 3, parent_id: "root" },
  { id: "child", name: "Child", diameter: 1, parent_id: "a" }
];

describe("sigil hierarchy drafts", () => {
  it("reorders siblings without changing stable identities or parent links", () => {
    const result = reorderNode(nodes, "b", -1);
    expect(orderedTree(result).map(({ node }) => node.id)).toEqual(["root", "b", "a", "child"]);
    expect(result.find((node) => node.id === "child")?.parent_id).toBe("a");
    expect(nodes[1].id).toBe("a");
  });

  it("duplicates a complete branch with fresh IDs and no copied charge", () => {
    const result = duplicateBranch(nodes, "a");
    const copies = result.slice(nodes.length);
    expect(copies).toHaveLength(2);
    expect(copies[1].parent_id).toBe(copies[0].id);
    expect(copies[0].parent_id).toBe("root");
    expect(copies.every((node) => !node.charge)).toBe(true);
    expect(new Set(result.map((node) => node.id)).size).toBe(result.length);
    expect(copies[0].action_id).toBe("spell");
  });

  it("identifies all descendants for safe reparenting and branch removal", () => {
    expect([...descendants(nodes, "a")].sort()).toEqual(["a", "child"]);
  });

  it("renders deeply nested trees without recursive traversal", () => {
    const deep = Array.from({ length: 1500 }, (_, i) => ({
      id: String(i),
      name: "Node",
      diameter: 1,
      parent_id: i ? String(i - 1) : null
    }));
    expect(orderedTree(deep).at(-1)?.depth).toBe(1499);
  });
});
