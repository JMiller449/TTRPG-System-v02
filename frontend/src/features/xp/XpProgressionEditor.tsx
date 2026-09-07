import { XpCurvePreview } from "./XpCurvePreview";
import { useEffect, useState } from "react";
import { useAppStore } from "@/app/state/useAppStore";
import type { GameClient } from "@/hooks/useGameClient";
import type { XpTrackerView } from "@/domain/ipc";
import { buildSetXpProgressionRequest } from "@/infrastructure/ws/requestBuilders";
import { Field } from "@/shared/ui/Field";

type Progression = NonNullable<XpTrackerView["progression"]>;
function withDefaults(progression: XpTrackerView["progression"]): Progression | null {
  return progression
    ? {
        ...progression,
        growth_multiplier_per_milestone: progression.growth_multiplier_per_milestone ?? 1
      }
    : null;
}
const knobs = [
  ["base_xp", "Base XP", "Overall scale of every level cost.", "0.01", "0.01"],
  [
    "growth_exponent",
    "Growth Exponent",
    "Base steepness. Higher makes later levels cost more.",
    "0.01",
    "0.01"
  ],
  ["milestone_interval", "Milestone Interval", "Number of levels between milestones.", "1", "1"],
  [
    "milestone_multiplier",
    "Milestone Entry Multiplier",
    "Multiplies entry cost only. 1.00 = no change.",
    "1",
    "0.01"
  ],
  [
    "growth_multiplier_per_milestone",
    "Growth Multiplier / Milestone",
    "Multiplies the exponent after each milestone. 1.00 = no change.",
    "1",
    "0.01"
  ],
  ["rounding", "Rounding Increment", "Nearest multiple; halfway rounds up.", "1", "1"]
] as const;

export function XpProgressionEditor({
  client,
  progression
}: {
  client: GameClient;
  progression: XpTrackerView["progression"];
}): JSX.Element {
  const [draft, setDraft] = useState<Progression | null>(() => withDefaults(progression));
  const [error, setError] = useState("");
  const { state } = useAppStore();
  const serialized = JSON.stringify(progression);
  useEffect(() => {
    setDraft(withDefaults(serialized ? (JSON.parse(serialized) as Progression) : null));
    setError("");
  }, [serialized]);
  const attributes = Object.values(state.serverState.attributes).filter(
    (attribute) => attribute.value_type === "number" && attribute.subject_types.includes("sheet")
  );

  if (!draft) return <p>Loading XP progression…</p>;
  return (
    <section className="xp-tracker-section xp-workspace-card xp-progression">
      <h3>XP to Next Level</h3>
      <p className="xp-progression__intro">Set the campaign’s pace. Level changes stay manual.</p>
      <div className="xp-progression__layout">
        <form
          className="xp-progression__form"
          onSubmit={(event) => {
            event.preventDefault();
            // Keep the server's valid settings for the inactive mode.
            const candidate =
              draft.mode === "formula"
                ? { ...progression, mode: draft.mode, expression: draft.expression }
                : { ...draft, expression: progression?.expression };
            if (
              knobs.some(
                ([key]) =>
                  !Number.isFinite(Number(candidate[key])) ||
                  (key === "growth_multiplier_per_milestone"
                    ? Number(candidate[key]) < 1
                    : Number(candidate[key]) <= 0)
              ) ||
              !candidate.expression?.trim()
            ) {
              setError("Enter valid tuning values; milestone multipliers must be at least 1.");
              return;
            }
            setError("");
            client.sendProtocolRequest(
              buildSetXpProgressionRequest(candidate),
              "Save XP progression"
            );
          }}
        >
          <div className="xp-progression__controls">
            <Field label="Goal calculation">
              <select
                value={draft.mode}
                onChange={(event) =>
                  setDraft({ ...draft, mode: event.target.value as Progression["mode"] })
                }
              >
                <option value="tuning">Tuning knobs</option>
                <option value="formula">Math equation</option>
              </select>
            </Field>
            {draft.mode === "formula" ? (
              <>
                <Field label="Lifetime XP target equation" required>
                  <textarea
                    required
                    maxLength={1000}
                    rows={3}
                    value={draft.expression}
                    onChange={(event) => setDraft({ ...draft, expression: event.target.value })}
                  />
                </Field>
                <p>
                  Example: 100 * @level ** 2. Use arithmetic, min, max, floor, ceil, or round. The
                  sheet’s XP Growth Rate is applied afterward, then rounded down to whole XP.
                </p>
                <Field label="Insert sheet Attribute">
                  <select
                    value=""
                    onChange={(event) => {
                      if (event.target.value)
                        setDraft({
                          ...draft,
                          expression: `${draft.expression ?? ""}@{${event.target.value}}`
                        });
                    }}
                  >
                    <option value="">Select an Attribute…</option>
                    {attributes.map((attribute) => (
                      <option key={attribute.id} value={attribute.id}>
                        {attribute.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            ) : (
              <div className="xp-progression__knobs">
                {knobs.map(([key, label, help, min, step]) => (
                  <Field key={key} label={label} required>
                    <input
                      type="number"
                      required
                      min={min}
                      step={step}
                      value={Number.isNaN(draft[key]) ? "" : draft[key]}
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          [key]: event.target.value === "" ? Number.NaN : Number(event.target.value)
                        })
                      }
                    />
                    <small>{help}</small>
                  </Field>
                ))}
              </div>
            )}
            {draft.mode === "tuning" ? (
              <button
                className="button button--secondary"
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    base_xp: 100,
                    growth_exponent: 1.35,
                    milestone_interval: 25,
                    milestone_multiplier: 1.08,
                    growth_multiplier_per_milestone: 1.02,
                    rounding: 10
                  })
                }
              >
                Use recommended settings
              </button>
            ) : null}
            <details className="xp-progression__help">
              <summary>How scaling works</summary>
              <p>
                Each level costs Base XP × current Level ^ effective exponent. The exponent is
                multiplied after each milestone reached. The milestone multiplier applies only when
                entering a milestone (24 → 25, for example), then XP Growth Rate is applied and the
                cost is rounded to the nearest increment. Lifetime targets sum these individual
                costs.
              </p>
              <p>Both multipliers use 1.00 for no change and 1.08 for an 8% increase.</p>
              <p>Recommended: 100 / 1.35 / 25 / 1.08 / 1.02 / 10.</p>
              <p>
                Edit XP Growth Rate on a template or character: 1 is normal, 0.8 is 20% easier, and
                1.2 is 20% harder. Templates seed new characters.
              </p>
              <p>
                Changing the curve recalculates lifetime targets without spending or resetting
                earned XP.
              </p>
            </details>
          </div>
          <footer className="xp-progression__footer">
            {error ? <p role="alert">{error}</p> : null}
            <button className="button button--primary" type="submit">
              Save XP Progression
            </button>
            <span>Applies to all characters when saved.</span>
          </footer>
        </form>
        <XpCurvePreview draft={draft} />
      </div>
    </section>
  );
}
