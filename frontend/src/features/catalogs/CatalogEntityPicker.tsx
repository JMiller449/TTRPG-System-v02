import type { CatalogKey } from "@/domain/models";
import { useCatalogOrganization } from "@/features/catalogs/useCatalogOrganization";
import { SearchPopoverPicker } from "@/shared/ui/SearchPopoverPicker";
import type { SearchPopoverOption } from "@/shared/ui/searchPopover";

export type CatalogEntityPickerOption<T> = SearchPopoverOption<T>;

export function CatalogEntityPicker<T>({
  catalog,
  ...props
}: {
  catalog: CatalogKey;
  label: string;
  placeholder: string;
  options: CatalogEntityPickerOption<T>[];
  selectedId?: string | null;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  required?: boolean;
  invalid?: boolean;
  ariaDescribedBy?: string;
  onSelect: (value: T) => void;
}): JSX.Element {
  const organization = useCatalogOrganization(catalog);

  return <SearchPopoverPicker {...props} organization={organization} />;
}
