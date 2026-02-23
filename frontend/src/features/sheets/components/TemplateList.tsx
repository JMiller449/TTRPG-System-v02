import type { SheetTemplate } from "@/domain/models";
import { EmptyState } from "@/shared/ui/EmptyState";
import { TemplateListItem } from "@/features/sheets/components/TemplateListItem";

export function TemplateList({
  templates,
  onEdit,
  onSpawn
}: {
  templates: SheetTemplate[];
  onEdit: (template: SheetTemplate) => void;
  onSpawn: (template: SheetTemplate) => void;
}): JSX.Element {
  return (
    <div className="list">
      {templates.length === 0 ? <EmptyState message="No templates found." /> : null}
      {templates.map((template) => (
        <TemplateListItem
          key={template.id}
          template={template}
          onEdit={() => onEdit(template)}
          onSpawn={() => onSpawn(template)}
        />
      ))}
    </div>
  );
}
