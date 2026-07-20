// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { KillEditor } from "@/features/xp/components/KillEditor";
import { PartyFolderWorkspace } from "@/features/xp/components/PartyFolderWorkspace";
import { PartyEditor } from "@/features/xp/components/PartyEditor";
import type { GameClient } from "@/hooks/useGameClient";

const client = {
  sendProtocolRequest: vi.fn()
} as unknown as GameClient;

describe("XP registry editors", () => {
  it("renders temporary party membership controls", () => {
    const markup = renderToStaticMarkup(
      <PartyEditor
        party={{
          id: "party_1",
          name: "Near the Gate",
          members: [{ instance_id: "hero_1", name: "Hero One" }]
        }}
        characters={[
          { instance_id: "hero_1", name: "Hero One" },
          { instance_id: "hero_2", name: "Hero Two" },
          { instance_id: "hero_3", name: "Hero Three" }
        ]}
        unavailableIds={new Set(["hero_2"])}
        client={client}
      />
    );

    expect(markup).toContain("Near the Gate");
    expect(markup).toContain("Hero One");
    expect(markup).not.toContain("Hero Two");
    expect(markup).toContain("Hero Three");
    expect(markup).toContain("Add Character");
    expect(markup).toContain("Remove");
    expect(markup).toContain("Save Party");
    expect(markup).not.toContain('type="checkbox"');
    expect(markup).toContain("disabled");
  });

  it("navigates named party folders and the unassigned character folder", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <PartyFolderWorkspace
          parties={[
            {
              id: "party_1",
              name: "Near the Gate",
              members: [{ instance_id: "hero_1", name: "Hero One" }]
            },
            {
              id: "party_2",
              name: "At the Keep",
              members: [{ instance_id: "hero_2", name: "Hero Two" }]
            }
          ]}
          characters={[
            {
              instance_id: "hero_1",
              sheet_id: "hero_template_1",
              name: "Hero One",
              kills: [],
              adjustments: [],
              current_xp: 0,
              xp_required: 100,
              ready_to_level: false
            },
            {
              instance_id: "hero_2",
              sheet_id: "hero_template_2",
              name: "Hero Two",
              kills: [],
              adjustments: [],
              current_xp: 0,
              xp_required: 100,
              ready_to_level: false
            },
            {
              instance_id: "hero_3",
              sheet_id: "hero_template_3",
              name: "Hero Three",
              kills: [],
              adjustments: [],
              current_xp: 0,
              xp_required: 100,
              ready_to_level: false
            }
          ]}
          client={client}
        />
      );
    });

    expect(container.textContent).toContain("Character Folders");
    expect(container.textContent).toContain("Hero One");
    expect(container.textContent).not.toContain("Hero Two");
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();

    const unassignedButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Unassigned")
    );
    await act(async () => unassignedButton?.click());
    expect(container.textContent).toContain("Unassigned Characters");
    expect(container.textContent).toContain("Hero Three");
    expect(container.textContent).not.toContain("Hero One");

    const keepButton = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("At the Keep")
    );
    await act(async () => keepButton?.click());
    expect(container.textContent).toContain("Hero Two");
    expect(container.textContent).not.toContain("Hero One");

    await act(async () => root.unmount());
  });

  it("saves explicit character moves without checkbox membership controls", async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement("div");
    const root = createRoot(container);
    const sendProtocolRequest = vi.fn();
    const interactiveClient = { sendProtocolRequest } as unknown as GameClient;
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);

    await act(async () => {
      root.render(
        <PartyEditor
          party={{
            id: "party_1",
            name: "Near the Gate",
            members: [{ instance_id: "hero_1", name: "Hero One" }]
          }}
          characters={[
            { instance_id: "hero_1", name: "Hero One" },
            { instance_id: "hero_2", name: "Hero Two" }
          ]}
          unavailableIds={new Set(["hero_1"])}
          client={interactiveClient}
        />
      );
    });

    const removeButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Remove"
    );
    await act(async () => removeButton?.click());
    expect(container.textContent).toContain("Hero One");
    expect(confirm).toHaveBeenCalledWith(
      "Remove “Hero One”?\n\nThis removes the character from this party when you save the folder."
    );
    confirm.mockReturnValue(true);
    await act(async () => removeButton?.click());

    const selector = container.querySelector<HTMLSelectElement>("select");
    await act(async () => {
      if (!selector) return;
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value"
      )?.set;
      valueSetter?.call(selector, "hero_2");
      selector.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const addButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Add Character"
    );
    await act(async () => addButton?.click());
    const saveButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Save Party"
    );
    expect(saveButton?.disabled).toBe(false);
    await act(async () => saveButton?.click());

    expect(sendProtocolRequest).toHaveBeenCalledWith(
      {
        type: "save_party",
        party_id: "party_1",
        name: "Near the Gate",
        member_instance_ids: ["hero_2"]
      },
      "Save party: Near the Gate"
    );
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();

    await act(async () => root.unmount());
    confirm.mockRestore();
  });

  it("renders historical participant and decimal XP editing", () => {
    const markup = renderToStaticMarkup(
      <KillEditor
        kill={{
          id: "kill_1",
          monster_name: "Goblin",
          base_xp: 100,
          participants: [
            { instance_id: "hero_1", name: "Hero One" },
            { instance_id: "hero_2", name: "Hero Two" }
          ],
          participant_count: 2,
          xp_percentage: 50,
          xp_per_participant: 50,
          occurred_at: "2026-07-01T19:00:00+00:00",
          monster_sheet_id: "goblin",
          notes: "Gate encounter"
        }}
        characters={[
          { instance_id: "hero_1", name: "Hero One" },
          { instance_id: "hero_2", name: "Hero Two" }
        ]}
        client={client}
        onClose={vi.fn()}
      />
    );

    expect(markup).toContain("Goblin");
    expect(markup).toContain('step="0.01"');
    expect(markup).toContain("Hero One");
    expect(markup).toContain("Hero Two");
    expect(markup).toContain("Save Changes");
  });
});
