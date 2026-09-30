import type { ReactNode } from "react";

export function CatalogEditorLayout({
  catalogLabel,
  catalog,
  editorClassName,
  children
}: {
  catalogLabel: string;
  catalog: ReactNode | null;
  editorClassName?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className={`authoring-workspace${catalog ? "" : " authoring-workspace--editor-only"}`}>
      {catalog ? (
        <aside className="authoring-workspace__catalog" aria-label={catalogLabel}>
          <p className="authoring-workspace__kicker">Catalog</p>
          <h3>{catalogLabel}</h3>
          <div className="authoring-workspace__catalog-scroll">{catalog}</div>
        </aside>
      ) : null}
      <section
        className={`authoring-workspace__editor${editorClassName ? ` ${editorClassName}` : ""}`}
        aria-label={`${catalogLabel} editor`}
      >
        {children}
      </section>
    </div>
  );
}
