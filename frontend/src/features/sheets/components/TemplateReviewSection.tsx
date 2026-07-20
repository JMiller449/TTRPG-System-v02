import type {
  TemplateEditorSection,
  TemplateEditorValues
} from "@/features/sheets/templateEditorTypes";
import type { TemplateEditorValidation } from "@/features/sheets/templateEditorValues";

const SECTION_LABELS: Record<TemplateEditorSection, string> = {
  details: "Details",
  profile: "Profile",
  stats: "Stats",
  attributes: "Attributes",
  resistances: "Resistances",
  actions: "Actions",
  proficiencies: "Proficiencies",
  inventory: "Inventory"
};

export function TemplateReviewSection({
  values,
  validation,
  onNavigate
}: {
  values: TemplateEditorValues;
  validation: TemplateEditorValidation;
  onNavigate: (section: TemplateEditorSection) => void;
}): JSX.Element {
  const errors = (Object.keys(SECTION_LABELS) as TemplateEditorSection[]).flatMap((section) =>
    validation.errors[section].map((message) => ({ section, message }))
  );
  const changedResistances = Object.values(values.resistances).filter(
    (value) => Number(value) !== 0
  ).length;

  return (
    <section className="template-builder__section stack" aria-labelledby="template-review-title">
      <div>
        <h3 id="template-review-title">Review Template</h3>
        <p className="muted">
          Confirm the essentials, then create the template. Empty optional sections are valid.
        </p>
      </div>

      {errors.length > 0 ? (
        <div className="template-builder__validation" role="alert">
          <strong>
            {errors.length} issue{errors.length === 1 ? "" : "s"} to resolve
          </strong>
          <ul>
            {errors.map((entry) => (
              <li key={`${entry.section}:${entry.message}`}>
                <button type="button" onClick={() => onNavigate(entry.section)}>
                  {SECTION_LABELS[entry.section]}
                </button>
                <span>{entry.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="template-builder__ready-message" role="status">
          <strong>Ready to create</strong>
          <span>All required values are valid.</span>
        </div>
      )}

      <div className="template-builder__review-grid">
        <article>
          <span className="template-builder__review-kicker">Core setup</span>
          <strong>{values.name.trim() || "Unnamed template"}</strong>
          <span>{values.kind === "player" ? "Player-controlled" : "GM-controlled"}</span>
          <span>Racial HP ×{values.racialHpMultiplier || "?"}</span>
          <button type="button" onClick={() => onNavigate("details")}>
            Edit details
          </button>
        </article>
        <article>
          <span className="template-builder__review-kicker">Starting content</span>
          <strong>
            {values.actions.length} actions · {values.proficiencies.length} proficiencies
          </strong>
          <span>{values.items.length} inventory entries</span>
          <button type="button" onClick={() => onNavigate("actions")}>
            Edit content
          </button>
        </article>
        <article>
          <span className="template-builder__review-kicker">Advanced customization</span>
          <strong>{Object.keys(values.attributes).length} attributes</strong>
          <span>{changedResistances} non-zero resistances</span>
          <button type="button" onClick={() => onNavigate("attributes")}>
            Edit advanced
          </button>
        </article>
      </div>
    </section>
  );
}
