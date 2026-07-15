import { useState } from "react";
import type { ItemDefinition } from "@/domain/models";
import type { PlayerItemSubmissionPayload } from "@/infrastructure/ws/requestBuilders";
import { Field } from "@/shared/ui/Field";

export function PlayerItemProposalForm({
  pendingItems,
  onSubmit
}: {
  pendingItems: ItemDefinition[];
  onSubmit: (item: PlayerItemSubmissionPayload) => void;
}): JSX.Element {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [weight, setWeight] = useState("0");
  const [interactionType, setInteractionType] = useState<"equippable" | "inventory_only">(
    "inventory_only"
  );
  const [canContainItems, setCanContainItems] = useState(false);
  const parsedWeight = Number(weight);
  const valid = name.trim().length > 0 && Number.isFinite(parsedWeight) && parsedWeight >= 0;

  return (
    <section
      className="character-sheet__section stack player-item-proposal"
      aria-labelledby="propose-item-title"
    >
      <div>
        <h4 id="propose-item-title">Propose a New Item</h4>
        <p className="muted">
          The DM must approve a proposed item before it is added to your inventory. Approved
          proposals become available to every player.
        </p>
      </div>
      <div className="inline-group">
        <Field label="Name">
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Kind">
          <select
            value={interactionType}
            onChange={(event) =>
              setInteractionType(event.target.value as "equippable" | "inventory_only")
            }
          >
            <option value="inventory_only">Inventory item</option>
            <option value="equippable">Equippable item</option>
          </select>
        </Field>
        <Field label="Category">
          <input value={category} onChange={(event) => setCategory(event.target.value)} />
        </Field>
        <Field label="Weight (lb)">
          <input
            type="number"
            min="0"
            step="any"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
          />
        </Field>
        <Field label="Value">
          <input value={price} onChange={(event) => setPrice(event.target.value)} />
        </Field>
      </div>
      <Field label="Description">
        <textarea
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <label className="augmentation-template-panel__active">
        <input
          type="checkbox"
          checked={canContainItems}
          onChange={(event) => setCanContainItems(event.target.checked)}
        />
        <span>This is a storage container</span>
      </label>
      <button
        type="button"
        className="button"
        disabled={!valid}
        onClick={() => {
          onSubmit({
            name: name.trim(),
            interaction_type: interactionType,
            category: category.trim(),
            rank: "",
            description: description.trim(),
            world_anvil_url: "",
            price: price.trim(),
            weight: parsedWeight,
            can_contain_items: canContainItems
          });
          setName("");
          setCategory("");
          setDescription("");
          setPrice("");
          setWeight("0");
          setInteractionType("inventory_only");
          setCanContainItems(false);
        }}
      >
        Send for DM Approval
      </button>
      {pendingItems.length > 0 ? (
        <div className="stack">
          <strong>Awaiting DM approval</strong>
          <div className="list">
            {pendingItems.map((item) => (
              <div className="list-item" key={item.id}>
                <span>{item.name}</span>
                <span className="pill">Pending</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
