import { CharacterProfileFields } from "@/features/sheets/components/CharacterProfileFields";
import type { TemplateEditorValues } from "@/features/sheets/templateEditorTypes";

export function TemplateProfileSection({
  values,
  onChange
}: {
  values: TemplateEditorValues;
  onChange: (values: TemplateEditorValues) => void;
}): JSX.Element {
  return (
    <section className="template-builder__section stack" aria-labelledby="template-profile-title">
      <div>
        <h3 id="template-profile-title">Character Profile</h3>
        <p className="muted">
          Optional flavor text copied into each newly spawned character. Spawned copies can be
          edited independently by the GM or their assigned player.
        </p>
      </div>
      <CharacterProfileFields
        profile={values.profile}
        onChange={(profile) => onChange({ ...values, profile })}
      />
    </section>
  );
}
