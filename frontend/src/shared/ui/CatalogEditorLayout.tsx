import type { ReactNode } from "react";

export function CatalogEditorLayout({
  catalogLabel,
  catalog,
  children
}: {
  catalogLabel: string;
  catalog: ReactNode;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="authoring-workspace">
      <aside className="authoring-workspace__catalog" aria-label={catalogLabel}>
        <p className="authoring-workspace__kicker">Catalog</p>
        <h3>{catalogLabel}</h3>
        <div className="authoring-workspace__catalog-scroll">{catalog}</div>
      </aside>
      <section className="authoring-workspace__editor" aria-label={`${catalogLabel} editor`}>
        {children}
      </section>
    </div>
  );
}
