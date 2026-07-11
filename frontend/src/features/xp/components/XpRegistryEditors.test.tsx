import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { KillEditor } from "@/features/xp/components/KillEditor";
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
          { instance_id: "hero_2", name: "Hero Two" }
        ]}
        unavailableIds={new Set(["hero_2"])}
        client={client}
      />
    );

    expect(markup).toContain("Near the Gate");
    expect(markup).toContain("Hero One");
    expect(markup).toContain("Hero Two");
    expect(markup).toContain("Save Party");
    expect(markup).toContain("disabled");
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
