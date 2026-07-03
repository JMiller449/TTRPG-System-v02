import type { HTMLAttributes, ReactElement, ReactNode } from "react";

export interface SystemPanelProps extends HTMLAttributes<HTMLElement> {
  title?: string;
  eyebrow?: string;
  actions?: ReactNode;
  variant?: "default" | "raised" | "critical" | "quiet";
  as?: "section" | "article" | "div";
}

export function SystemPanel({
  title,
  eyebrow,
  actions,
  variant = "default",
  as: Component = "section",
  className = "",
  children,
  ...rest
}: SystemPanelProps): ReactElement {
  const classes = ["r6-panel", `r6-panel--${variant}`, className].filter(Boolean).join(" ");

  return (
    <Component className={classes} {...rest}>
      <span className="r6-panel__corner r6-panel__corner--tl" aria-hidden="true" />
      <span className="r6-panel__corner r6-panel__corner--tr" aria-hidden="true" />
      <span className="r6-panel__corner r6-panel__corner--bl" aria-hidden="true" />
      <span className="r6-panel__corner r6-panel__corner--br" aria-hidden="true" />
      {title || eyebrow || actions ? (
        <header className="r6-panel__header">
          <div className="r6-panel__heading-group">
            {eyebrow ? <p className="r6-panel__eyebrow">{eyebrow}</p> : null}
            {title ? <h2 className="r6-panel__title">{title}</h2> : null}
          </div>
          {actions ? <div className="r6-panel__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className="r6-panel__body">{children}</div>
    </Component>
  );
}
