import { useOptionalAppState } from "@/app/state/useAppStore";
import { CatalogEntityPicker } from "@/features/catalogs/CatalogEntityPicker";

export function FormulaReferenceEditor({
  formulaId,
  onChange,
  label = "Formula",
  required = true,
  invalid = false
}: {
  formulaId: string | null;
  onChange: (formulaId: string) => void;
  label?: string;
  required?: boolean;
  invalid?: boolean;
}): JSX.Element {
  const appState = useOptionalAppState();
  const formulas = appState?.serverState.formulas ?? {};
  const formulaOrder = appState?.serverState.formulaOrder ?? [];
  const options = formulaOrder
    .map((id) => formulas[id])
    .filter(Boolean)
    .map((formula) => ({
      id: formula.id,
      label: formula.id,
      secondary: formula.formula.text,
      value: formula.id
    }));

  return (
    <CatalogEntityPicker
      catalog="formulas"
      label={label}
      placeholder="Select a formula"
      options={options}
      selectedId={formulaId}
      required={required}
      invalid={invalid}
      emptyMessage="No formulas exist yet. Create one in Formula Authoring first."
      onSelect={onChange}
    />
  );
}
