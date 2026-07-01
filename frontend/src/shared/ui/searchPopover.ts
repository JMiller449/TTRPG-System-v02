export interface SearchPopoverOption<T> {
  id: string;
  label: string;
  secondary?: string;
  keywords?: string[];
  disabledReason?: string;
  value: T;
}

export function filterSearchPopoverOptions<T>(
  options: SearchPopoverOption<T>[],
  query: string
): SearchPopoverOption<T>[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return options;
  }
  return options.filter((option) =>
    [option.label, option.secondary ?? "", ...(option.keywords ?? [])]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery)
  );
}

export function nextEnabledOptionIndex<T>({
  options,
  currentIndex,
  direction
}: {
  options: SearchPopoverOption<T>[];
  currentIndex: number;
  direction: "next" | "previous" | "first" | "last";
}): number {
  if (options.length === 0) {
    return -1;
  }
  const enabledIndexes = options
    .map((option, index) => (option.disabledReason ? -1 : index))
    .filter((index) => index >= 0);
  if (enabledIndexes.length === 0) {
    return -1;
  }
  if (direction === "first") {
    return enabledIndexes[0] ?? -1;
  }
  if (direction === "last") {
    return enabledIndexes.at(-1) ?? -1;
  }
  if (direction === "next") {
    return enabledIndexes.find((index) => index > currentIndex) ?? enabledIndexes[0] ?? -1;
  }
  return (
    [...enabledIndexes].reverse().find((index) => index < currentIndex) ??
    enabledIndexes.at(-1) ??
    -1
  );
}

export interface SearchPopoverPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

export function calculateSearchPopoverPosition({
  anchor,
  viewportWidth,
  viewportHeight
}: {
  anchor: Pick<DOMRect, "top" | "right" | "bottom" | "left" | "width">;
  viewportWidth: number;
  viewportHeight: number;
}): SearchPopoverPosition {
  const margin = 8;
  const gap = 4;
  const below = viewportHeight - anchor.bottom - gap - margin;
  const above = anchor.top - gap - margin;
  const placeAbove = below < 160 && above > below;
  const availableHeight = placeAbove ? above : below;
  const maxHeight = Math.max(80, Math.min(320, availableHeight));
  const width = Math.min(Math.max(anchor.width, 320), viewportWidth - margin * 2);
  const left = Math.min(Math.max(margin, anchor.left), viewportWidth - width - margin);
  const top = placeAbove
    ? Math.max(margin, anchor.top - gap - maxHeight)
    : Math.min(viewportHeight - margin, anchor.bottom + gap);
  return { top, left, width, maxHeight };
}
