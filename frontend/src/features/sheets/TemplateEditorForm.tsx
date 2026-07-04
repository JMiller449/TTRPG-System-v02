import { useMemo, useState } from "react";
import type { ActionFormulaAuthoringMetadata } from "@/domain/ipc";
import type {
  ActionDefinition,
  FactDefinition,
  ItemDefinition,
  ProficiencyDefinition
} from "@/domain/models";
import {
  TemplateActionsSection,
  TemplateInventorySection,
  TemplateProficienciesSection
} from "@/features/sheets/components/TemplateAssignmentsSection";
import { TemplateDetailsSection } from "@/features/sheets/components/TemplateDetailsSection";
import { TemplateFactsSection } from "@/features/sheets/components/TemplateFactsSection";
import { TemplateResistancesSection } from "@/features/sheets/components/TemplateResistancesSection";
import { TemplateStatsSection } from "@/features/sheets/components/TemplateStatsSection";
import type {
  TemplateEditorErrors,
  TemplateEditorSection,
  TemplateEditorValues
} from "@/features/sheets/templateEditorTypes";
import {
  validateTemplateEditorValues,
  type TemplateReferenceCatalogs
} from "@/features/sheets/templateEditorValues";
import type { TemplateContextualEntityKind } from "@/features/sheets/templateContextualAuthoring";

const SECTIONS: ReadonlyArray<{ id: TemplateEditorSection; label: string }> = [
  { id: "details", label: "Details" },
  { id: "stats", label: "Stats" },
  { id: "facts", label: "Facts" },
  { id: "resistances", label: "Resistances" },
  { id: "actions", label: "Actions" },
  { id: "proficiencies", label: "Proficiencies" },
  { id: "inventory", label: "Inventory" }
];

function ValidationSummary({ errors }: { errors: TemplateEditorErrors }): JSX.Element | null {
  const entries = SECTIONS.flatMap((section) =>
    errors[section.id].map((message) => ({ section: section.label, message }))
  );
  if (entries.length === 0) {
    return null;
  }
  return (
    <div className="template-builder__validation" role="alert">
      <strong>
        {entries.length} issue{entries.length === 1 ? "" : "s"} to resolve
      </strong>
      <ul>
        {entries.map((entry) => (
          <li key={`${entry.section}:${entry.message}`}>
            <b>{entry.section}:</b> {entry.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

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
  facts,
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
  facts: Record<string, FactDefinition>;
  metadata: ActionFormulaAuthoringMetadata | null;
  pending?: boolean;
  onCreateReference?: (kind: TemplateContextualEntityKind) => void;
  onChange: (next: TemplateEditorValues) => void;
  onSubmit: () => void;
  onCancel?: () => void;
}): JSX.Element {
  const [activeSection, setActiveSection] = useState<TemplateEditorSection>("details");
  const catalogs: TemplateReferenceCatalogs = useMemo(
    () => ({ actions, proficiencies, items, facts }),
    [actions, facts, items, proficiencies]
  );
  const validation = useMemo(
    () => validateTemplateEditorValues(values, catalogs),
    [catalogs, values]
  );

  return (
    <form
      className="template-builder"
      onSubmit={(event) => {
        event.preventDefault();
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
        <span className={`pill ${validation.isValid ? "pill--resolved" : "pill--failed"}`}>
          {validation.isValid ? "Ready to save" : "Draft needs attention"}
        </span>
      </header>

      <div className="template-builder__tabs" role="tablist" aria-label="Template sections">
        {SECTIONS.map((section) => {
          const errorCount = validation.errors[section.id].length;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={activeSection === section.id}
              className={activeSection === section.id ? "is-active" : ""}
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
              {errorCount > 0 ? (
                <span aria-label={`${errorCount} errors`}>{errorCount}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="template-builder__content" role="tabpanel">
        {activeSection === "details" ? (
          <TemplateDetailsSection values={values} onChange={onChange} />
        ) : null}
        {activeSection === "stats" ? (
          <TemplateStatsSection values={values} metadata={metadata} onChange={onChange} />
        ) : null}
        {activeSection === "facts" ? (
          <TemplateFactsSection
            values={values}
            definitions={facts}
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
      </div>

      <ValidationSummary errors={validation.errors} />
      <footer className="template-builder__footer">
        {onCancel ? (
          <button type="button" className="button button--secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="button" disabled={!validation.isValid || pending}>
          {pending ? "Saving..." : submitLabel}
        </button>
      </footer>
    </form>
  );
}
