import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ActionDefinitionCard } from "@/features/actions/components/ActionDefinitionCard";

describe("ActionDefinitionCard", () => {
  it("renders authoritative Action Attributes", () => {
    const markup = renderToStaticMarkup(
      <ActionDefinitionCard
        action={{
          id: "fire_bolt",
          name: "Fire Bolt",
          attributes: {
            action_mana_cost: {
              relationship_id: "fire-bolt-mana",
              attribute_id: "action_mana_cost",
              value: { type: "number", value: 25 },
              evaluated_value: 25,
              evaluation_error: null
            }
          }
        }}
        attributeDefinitions={{
          action_mana_cost: {
            id: "action_mana_cost",
            name: "Mana Cost",
            subject_types: ["action"],
            value_type: "number",
            default_value: { type: "number", value: 0 },
            unit: "mana",
            backend_owned: true
          }
        }}
        onEdit={() => undefined}
        onDelete={() => undefined}
      />
    );

    expect(markup).toContain("Mana Cost");
    expect(markup).toContain("25 mana");
  });

  it("identifies GM-only Roll20 message steps", () => {
    const markup = renderToStaticMarkup(
      <ActionDefinitionCard
        action={{
          id: "secret_check",
          name: "Secret Check",
          steps: [
            {
              step_id: "secret_roll",
              type: "send_message",
              visibility: "gm",
              message: { aliases: null, text: "Secret: /r 1d20" }
            }
          ]
        }}
        attributeDefinitions={{}}
        onEdit={() => undefined}
        onDelete={() => undefined}
      />
    );

    expect(markup).toContain("secret_roll: send GM message");
  });
});
