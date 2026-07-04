import { useMemo, useState } from "react";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type {
  ActionDefinition,
  AttributeDefinition,
  ItemDefinition,
  ProficiencyDefinition
} from "@/domain/models";
import {
  TemplateActionsSection,
  TemplateInventorySection,
  TemplateProficienciesSection
} from "@/features/sheets/components/TemplateAssignmentsSection";
import { TemplateDetailsSection } from "@/features/sheets/components/TemplateDetailsSection";
import { TemplateAttributesSection } from "@/features/sheets/components/TemplateAttributesSection";
import { TemplateResistancesSection } from "@/features/sheets/components/TemplateResistancesSection";
import { TemplateReviewSection } from "@/features/sheets/components/TemplateReviewSection";
import { TemplateStatsSection } from "@/features/sheets/components/TemplateStatsSection";
import type {
  TemplateEditorSection,
  TemplateEditorValues
} from "@/features/sheets/templateEditorTypes";
import {
  validateTemplateEditorValues,
  type TemplateReferenceCatalogs
} from "@/features/sheets/templateEditorValues";
import type { TemplateContextualEntityKind } from "@/features/sheets/templateContextualAuthoring";

type BuilderSection = TemplateEditorSection | "review";

const SECTIONS: ReadonlyArray<{
  id: BuilderSection;
  label: string;
  group: "Core setup" | "Starting content" | "Advanced" | "Finish";
  status: string;
}> = [
  { id: "details", label: "Details", group: "Core setup", status: "Required" },
  { id: "stats", label: "Stats", group: "Core setup", status: "Defaults included" },
  { id: "actions", label: "Actions", group: "Starting content", status: "Optional" },
  {
    id: "proficiencies",
    label: "Proficiencies",
    group: "Starting content",
    status: "Optional"
  },
  { id: "inventory", label: "Inventory", group: "Starting content", status: "Optional" },
  { id: "attributes", label: "Attributes", group: "Advanced", status: "Optional" },
  { id: "resistances", label: "Resistances", group: "Advanced", status: "Optional" },
  { id: "review", label: "Review", group: "Finish", status: "Final check" }
];

export function TemplateEditorForm({
  title,
  submitLabel,
  values,
  actions,
  actionOrder,
  proficiencies,
  proficiencyOrder,
  items,
  itemOrder,
  attributes,
  metadata,
  pending = false,
  onCreateReference,
  onChange,
  onSubmit,
  onCancel
}: {
  title: string;
  submitLabel: string;
  values: TemplateEditorValues;
  actions: Record<string, ActionDefinition>;
  actionOrder: string[];
  proficiencies: Record<string, ProficiencyDefinition>;
  proficiencyOrder: string[];
  items: Record<string, ItemDefinition>;
  itemOrder: string[];
  attributes: Record<string, AttributeDefinition>;
  metadata: ActionFormulaAuthoringMetadata | null;
  pending?: boolean;
  onCreateReference?: (kind: TemplateContextualEntityKind) => void;
  onChange: (next: TemplateEditorValues) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}): JSX.Element {
  const [activeSection, setActiveSection] = useState<BuilderSection>("details");
  const [reviewRequested, setReviewRequested] = useState(false);
  const catalogs: TemplateReferenceCatalogs = useMemo(
    () => ({ actions, proficiencies, items, attributes }),
    [actions, attributes, items, proficiencies]
  );
  const validation = useMemo(
    () => validateTemplateEditorValues(values, catalogs),
    [catalogs, values]
  );

  return (
    <form
      className="template-builder"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setReviewRequested(true);
        setActiveSection("review");
        if (validation.isValid && !pending) {
          onSubmit();
        }
      }}
    >
      <header className="template-builder__heading">
        <div>
          <h2>{title}</h2>
          <span className="muted">
            {values.kind === "player" ? "Player-controlled" : "GM-controlled"}
          </span>
        </div>
        <span className={`pill ${validation.isValid ? "pill--resolved" : "pill--draft"}`}>
          {validation.isValid ? "Ready for review" : "Draft in progress"}
        </span>
      </header>

      <div className="template-builder__tabs" role="tablist" aria-label="Template sections">
        {SECTIONS.map((section, index) => {
          const previousSection = SECTIONS[index - 1];
          const showGroup = !previousSection || previousSection.group !== section.group;
          const errorCount =
            section.id === "review" ? 0 : validation.errors[section.id].length;
          return [
            showGroup ? (
              <span className="template-builder__tab-group" key={`${section.group}-label`}>
                {section.group}
              </span>
            ) : null,
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={activeSection === section.id}
              className={activeSection === section.id ? "is-active" : ""}
              onClick={() => {
                if (section.id === "review") {
                  setReviewRequested(true);
                }
                setActiveSection(section.id);
              }}
            >
              <span className="template-builder__tab-number" aria-hidden="true">
                {index + 1}
              </span>
              <span className="template-builder__tab-copy">
                <span className="template-builder__tab-label">{section.label}</span>
                <small>{section.status}</small>
              </span>
              {reviewRequested && errorCount > 0 ? (
                <span className="template-builder__tab-errors" aria-label={`${errorCount} errors`}>
                  {errorCount}
                </span>
              ) : null}
            </button>
          ];
        })}
      </div>

      <div className="template-builder__content" role="tabpanel">
        {activeSection === "details" ? (
          <TemplateDetailsSection values={values} onChange={onChange} />
        ) : null}
        {activeSection === "stats" ? (
          <TemplateStatsSection values={values} metadata={metadata} onChange={onChange} />
        ) : null}
        {activeSection === "attributes" ? (
          <TemplateAttributesSection
            values={values}
            definitions={attributes}
            metadata={metadata}
            onCreateNew={onCreateReference}
            onChange={onChange}
          />
        ) : null}
        {activeSection === "resistances" ? (
          <TemplateResistancesSection values={values} onChange={onChange} />
        ) : null}
        {activeSection === "actions" ? (
          <TemplateActionsSection
            values={values}
            actions={actions}
            actionOrder={actionOrder}
            onCreateNew={onCreateReference}
            onChange={onChange}
          />
        ) : null}
        {activeSection === "proficiencies" ? (
          <TemplateProficienciesSection
            values={values}
            proficiencies={proficiencies}
            proficiencyOrder={proficiencyOrder}
            onCreateNew={onCreateReference}
            onChange={onChange}
          />
        ) : null}
        {activeSection === "inventory" ? (
          <TemplateInventorySection
            values={values}
            items={items}
            itemOrder={itemOrder}
            onCreateNew={onCreateReference}
            onChange={onChange}
          />
        ) : null}
        {activeSection === "review" ? (
          <TemplateReviewSection
            values={values}
            validation={validation}
            onNavigate={setActiveSection}
          />
        ) : null}
      </div>

      <footer className="template-builder__footer">
        <p className="muted">
          {activeSection === "review"
            ? validation.isValid
              ? "Everything required is ready. Optional sections can stay empty."
              : "Use the Review links to fix the required fields."
            : "Only Details is required; the remaining sections have safe defaults or are optional."}
        </p>
        {onCancel ? (
          <button type="button" className="button button--secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        {activeSection === "review" ? (
          <button type="submit" className="button" disabled={!validation.isValid || pending}>
            {pending ? "Saving..." : submitLabel}
          </button>
        ) : (
          <button
            type="button"
            className="button"
            onClick={() => {
              setReviewRequested(true);
              setActiveSection("review");
            }}
          >
            Review Template
          </button>
        )}
      </footer>
    </form>
  );
}
