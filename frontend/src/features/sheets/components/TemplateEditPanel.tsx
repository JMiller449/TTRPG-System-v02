import type { TemplateEditorValues } from "@/features/sheets/TemplateEditorForm";
import { TemplateEditorForm } from "@/features/sheets/TemplateEditorForm";

export function TemplateEditPanel({
  editingTemplateId,
  editingTemplateName,
  values,
  onChange,
  onSubmit,
  onCancel
}: {
  editingTemplateId: string | null;
  editingTemplateName: string | undefined;
  values: TemplateEditorValues;
  onChange: (values: TemplateEditorValues) => void;
  onSubmit: () => void;
  onCancel: () => void;
}): JSX.Element | null {
  if (!editingTemplateId) {
    return null;
  }

  return (
    <TemplateEditorForm
      title={`Edit Template (${editingTemplateName ?? editingTemplateId})`}
      submitLabel="Save Template"
      values={values}
      onChange={onChange}
      onSubmit={onSubmit}
      onCancel={onCancel}
    />
  );
}
