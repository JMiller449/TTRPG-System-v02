import { useEffect, useState } from "react";
import type { IntentFeedbackItem } from "@/app/state/types";
import type { ProficiencyDefinition } from "@/domain/models";
import type { GameClient } from "@/hooks/useGameClient";
import { CatalogEntityMultiSelect } from "@/features/catalogs/CatalogEntityMultiSelect";
import { buildCreateWeaponWithActionsRequest } from "@/infrastructure/ws/requestBuilders";
import { Field } from "@/shared/ui/Field";
import { makeId } from "@/shared/utils/id";

type WeaponRecipe = "attack" | "damage" | "parry";
type GoverningStat = "strength" | "dexterity" | "constitution" | "perception" | "arcane" | "will";

const GOVERNING_STATS: GoverningStat[] = [
  "strength",
  "dexterity",
  "constitution",
  "perception",
  "arcane",
  "will"
];

type RecipeDraft = {
  draftId: string;
  recipe: WeaponRecipe;
  label: string;
  description: string;
  included: boolean;
  name: string;
  proficiencyId: string;
  additionalProficiencyIds: string[];
  actionPointCost: string;
};

function recipeDrafts(prefix: string): RecipeDraft[] {
  return [
    {
      draftId: makeId("weapon_recipe"),
      recipe: "attack",
      label: "Attack",
      description: "Roll to hit using the weapon proficiency and governing stat.",
      included: true,
      name: `${prefix} — Attack`,
      proficiencyId: "",
      additionalProficiencyIds: [],
      actionPointCost: "1"
    },
    {
      draftId: makeId("weapon_recipe"),
      recipe: "damage",
      label: "Damage",
      description: "Roll base damage plus proficiency-scaled governing stat.",
      included: true,
      name: `${prefix} — Damage`,
      proficiencyId: "",
      additionalProficiencyIds: [],
      actionPointCost: "0"
    },
    {
      draftId: makeId("weapon_recipe"),
      recipe: "parry",
      label: "Parry",
      description: "Oppose an attack using the chosen proficiency and weapon stat.",
      included: false,
      name: `${prefix} — Parry`,
      proficiencyId: "",
      additionalProficiencyIds: [],
      actionPointCost: "1"
    }
  ];
}

function additionalRecipeDraft(
  prefix: string,
  recipe: WeaponRecipe,
  existing: RecipeDraft[]
): RecipeDraft {
  const label = recipe[0].toUpperCase() + recipe.slice(1);
  const ordinal = existing.filter((entry) => entry.recipe === recipe).length + 1;
  const defaultCosts: Record<WeaponRecipe, string> = {
    attack: "1",
    damage: "0",
    parry: "1"
  };
  const descriptions: Record<WeaponRecipe, string> = {
    attack: "Roll to hit using the weapon proficiency and governing stat.",
    damage: "Roll base damage plus proficiency-scaled governing stat.",
    parry: "Oppose an attack using the chosen proficiency and weapon stat."
  };
  return {
    draftId: makeId("weapon_recipe"),
    recipe,
    label: `${label} ${ordinal}`,
    description: descriptions[recipe],
    included: true,
    name: `${prefix} — ${label} ${ordinal}`,
    proficiencyId: "",
    additionalProficiencyIds: [],
    actionPointCost: defaultCosts[recipe]
  };
}

export function WeaponBuilderWizard({
  client,
  proficiencies,
  intentFeedback
}: {
  client: GameClient;
  proficiencies: ProficiencyDefinition[];
  intentFeedback: IntentFeedbackItem[];
}): JSX.Element {
  const [prefix, setPrefix] = useState("");
  const [description, setDescription] = useState("");
  const [rank, setRank] = useState("");
  const [price, setPrice] = useState("");
  const [weight, setWeight] = useState("0");
  const [publishToPlayers, setPublishToPlayers] = useState(false);
  const [governingStat, setGoverningStat] = useState<GoverningStat>("strength");
  const [baseDamage, setBaseDamage] = useState("0");
  const [recipes, setRecipes] = useState<RecipeDraft[]>(() => recipeDrafts("Weapon"));
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<{
    requestId: string;
    count: number;
    itemName: string;
  } | null>(null);
  const includedRecipes = recipes.filter((recipe) => recipe.included);
  const parsedBaseDamage = Number(baseDamage);
  const parsedWeight = Number(weight);
  const invalidRecipe = includedRecipes.find((recipe) => {
    const cost = Number(recipe.actionPointCost);
    return (
      !recipe.name.trim() ||
      !recipe.proficiencyId ||
      !/^\d+$/.test(recipe.actionPointCost.trim()) ||
      !Number.isSafeInteger(cost) ||
      cost < 0 ||
      cost > 100
    );
  });
  const canCreate =
    !pendingRequest &&
    Boolean(prefix.trim()) &&
    includedRecipes.length > 0 &&
    !invalidRecipe &&
    baseDamage.trim() !== "" &&
    Number.isFinite(parsedBaseDamage) &&
    parsedBaseDamage >= 0 &&
    Number.isFinite(parsedWeight) &&
    parsedWeight >= 0;

  const updateRecipe = (index: number, patch: Partial<RecipeDraft>): void => {
    setRecipes((current) =>
      current.map((recipe, recipeIndex) =>
        recipeIndex === index ? { ...recipe, ...patch } : recipe
      )
    );
    setSubmittedMessage(null);
  };

  const renamePrefix = (nextPrefix: string): void => {
    const previousPrefix = prefix;
    setPrefix(nextPrefix);
    setRecipes((current) =>
      current.map((recipe) => ({
        ...recipe,
        name:
          recipe.name === `${previousPrefix} — ${recipe.label}`
            ? `${nextPrefix} — ${recipe.label}`
            : recipe.name
      }))
    );
    setSubmittedMessage(null);
  };

  useEffect(() => {
    if (!pendingRequest) {
      return;
    }
    const feedback = intentFeedback.find(
      (entry) => entry.intentId === pendingRequest.requestId && entry.status !== "pending"
    );
    if (!feedback) {
      return;
    }
    setSubmittedMessage(
      feedback.status === "success"
        ? `${pendingRequest.itemName} and ${pendingRequest.count} action${pendingRequest.count === 1 ? "" : "s"} created.`
        : feedback.message
    );
    setPendingRequest(null);
  }, [intentFeedback, pendingRequest]);

  const createActions = (): void => {
    if (!canCreate) {
      return;
    }
    const entries = includedRecipes.map((recipe) => ({
      action_id: makeId("action"),
      name: recipe.name.trim(),
      recipe: recipe.recipe,
      proficiency_id: recipe.proficiencyId,
      additional_proficiency_ids: recipe.additionalProficiencyIds,
      action_point_cost: Number(recipe.actionPointCost)
    }));
    const requestId = makeId("request");
    client.sendProtocolRequest(
      buildCreateWeaponWithActionsRequest({
        item: {
          id: makeId("item"),
          name: prefix.trim(),
          interaction_type: "equippable",
          rank: rank.trim(),
          description: description.trim(),
          world_anvil_url: "",
          gm_notes: "",
          gm_special_properties: "",
          price: price.trim(),
          weight: parsedWeight,
          player_catalog_access: {
            mode: publishToPlayers ? "all" : "none",
            instance_ids: []
          },
          can_contain_items: false,
          storage_capacity_weight: null,
          contents_weight_behavior: "normal",
          tags: [],
          attributes: {},
          effect_ids: [],
          action_grants: []
        },
        governingStat,
        baseDamage: parsedBaseDamage,
        entries,
        requestId
      }),
      `Create weapon: ${prefix.trim()}`
    );
    setPendingRequest({ requestId, count: entries.length, itemName: prefix.trim() });
    setSubmittedMessage(null);
  };

  return (
    <section className="weapon-action-wizard stack" aria-label="Weapon builder">
      <div>
        <h3>Build a Weapon</h3>
        <p className="muted">
          Create one equippable weapon and its selected Actions together. Everything created here
          remains editable in the normal Item and Action builders.
        </p>
      </div>
      <div className="weapon-action-wizard__identity-fields">
        <Field label="Weapon name" required>
          <input
            value={prefix}
            placeholder="e.g. Light Steps"
            onChange={(event) => renamePrefix(event.target.value)}
          />
        </Field>
        <Field label="Rank">
          <input
            value={rank}
            placeholder="e.g. C"
            onChange={(event) => setRank(event.target.value)}
          />
        </Field>
        <Field label="Weight" required>
          <input
            type="number"
            min="0"
            step="any"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
          />
        </Field>
        <Field label="Price">
          <input value={price} onChange={(event) => setPrice(event.target.value)} />
        </Field>
      </div>
      <Field label="Description">
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={publishToPlayers}
          onChange={(event) => setPublishToPlayers(event.target.checked)}
        />
        <span>Make this weapon available in every player item catalog</span>
      </label>
      <div className="weapon-action-wizard__weapon-fields">
        <Field label="Governing stat" required>
          <select
            value={governingStat}
            onChange={(event) => setGoverningStat(event.target.value as GoverningStat)}
          >
            {GOVERNING_STATS.map((stat) => (
              <option key={stat} value={stat}>
                {stat[0].toUpperCase() + stat.slice(1)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Base damage" required>
          <input
            type="number"
            min="0"
            step="any"
            value={baseDamage}
            onChange={(event) => setBaseDamage(event.target.value)}
          />
        </Field>
      </div>
      <p className="muted">
        Governing Stat and Base Damage are stored as standard weapon Attributes on the new Item.
      </p>
      <div className="weapon-action-wizard__recipes">
        {recipes.map((recipe, index) => (
          <article
            className={`weapon-action-wizard__recipe${
              recipe.included ? " weapon-action-wizard__recipe--included" : ""
            }`}
            key={recipe.draftId}
          >
            <label className="weapon-action-wizard__include">
              <input
                type="checkbox"
                checked={recipe.included}
                onChange={(event) => updateRecipe(index, { included: event.target.checked })}
              />
              <span>
                <strong>Include {recipe.label}</strong>
                <small>{recipe.description}</small>
              </span>
            </label>
            {recipe.included ? (
              <div className="weapon-action-wizard__recipe-fields">
                <Field label="Generated action name" required>
                  <input
                    value={recipe.name}
                    onChange={(event) => updateRecipe(index, { name: event.target.value })}
                  />
                </Field>
                <Field
                  label={recipe.recipe === "parry" ? "Chosen proficiency" : "Weapon proficiency"}
                  required
                >
                  <select
                    value={recipe.proficiencyId}
                    onChange={(event) =>
                      updateRecipe(index, {
                        proficiencyId: event.target.value,
                        additionalProficiencyIds: recipe.additionalProficiencyIds.filter(
                          (proficiencyId) => proficiencyId !== event.target.value
                        )
                      })
                    }
                  >
                    <option value="">Select proficiency</option>
                    {proficiencies.map((proficiency) => (
                      <option key={proficiency.id} value={proficiency.id}>
                        {proficiency.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <CatalogEntityMultiSelect
                  catalog="proficiencies"
                  label="Additional proficiencies"
                  options={proficiencies
                    .filter((proficiency) => proficiency.id !== recipe.proficiencyId)
                    .map((proficiency) => ({
                      id: proficiency.id,
                      label: proficiency.name,
                      secondary: proficiency.description
                    }))}
                  selectedIds={recipe.additionalProficiencyIds}
                  onChange={(additionalProficiencyIds) =>
                    updateRecipe(index, { additionalProficiencyIds })
                  }
                  emptyMessage="No additional proficiencies available."
                  noResultsMessage="No proficiencies match this search."
                  selectionAriaLabel={(name) => `Select additional proficiency ${name}`}
                  folderSelectionAriaLabel={(name) =>
                    `Select all additional proficiencies in ${name}`
                  }
                  layout="chips"
                />
                <Field label="Action point cost" required>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={recipe.actionPointCost}
                    onChange={(event) =>
                      updateRecipe(index, { actionPointCost: event.target.value })
                    }
                  />
                </Field>
              </div>
            ) : null}
          </article>
        ))}
      </div>
      <div className="inline-actions" aria-label="Add another weapon action">
        {(["attack", "damage", "parry"] as const).map((recipe) => (
          <button
            className="button button--secondary"
            type="button"
            key={recipe}
            disabled={recipes.length >= 12}
            onClick={() =>
              setRecipes((current) => [...current, additionalRecipeDraft(prefix, recipe, current)])
            }
          >
            Add another {recipe}
          </button>
        ))}
      </div>
      <div className="weapon-action-wizard__preview">
        <strong>Will create {prefix.trim() || "this weapon"} with</strong>
        {includedRecipes.length ? (
          <ul>
            {includedRecipes.map((recipe) => (
              <li key={recipe.draftId}>{recipe.name || `Unnamed ${recipe.label}`}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">Select at least one action.</p>
        )}
      </div>
      <div className="inline-actions">
        <button
          className="button button--primary"
          type="button"
          disabled={!canCreate}
          onClick={createActions}
        >
          {pendingRequest ? "Creating weapon…" : "Create Weapon"}
        </button>
      </div>
      {submittedMessage ? <p role="status">{submittedMessage}</p> : null}
    </section>
  );
}
