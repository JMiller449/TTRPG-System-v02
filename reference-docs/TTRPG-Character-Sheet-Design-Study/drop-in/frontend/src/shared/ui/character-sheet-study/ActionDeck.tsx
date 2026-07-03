import { useMemo, useState, type ReactElement } from "react";
import { ActionCard } from "./ActionCard";
import { StudyIcon } from "./StudyIcon";
import type { ActionViewModel } from "./types";

export function ActionDeck({
  actions,
  title = "Actions",
  emptyMessage = "No actions are assigned to this sheet."
}: {
  actions: readonly ActionViewModel[];
  title?: string;
  emptyMessage?: string;
}): ReactElement {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(actions.map((action) => action.category))).sort()],
    [actions]
  );

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return actions.filter((action) => {
      if (category !== "All" && action.category !== category) return false;
      if (favoritesOnly && !action.isFavorite) return false;
      if (!normalized) return true;
      return [action.name, action.summary, action.category, ...(action.tags ?? [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [actions, category, favoritesOnly, query]);

  return (
    <section className="cs-section" aria-labelledby="cs-action-deck-title">
      <div className="cs-section__heading">
        <div>
          <p className="cs-eyebrow">Play controls</p>
          <h2 id="cs-action-deck-title">{title}</h2>
        </div>
        <span className="cs-count">{visible.length} shown</span>
      </div>

      <div className="cs-action-tools">
        <label className="cs-search">
          <span className="cs-sr-only">Search actions</span>
          <StudyIcon name="search" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actions" />
        </label>
        <button
          type="button"
          className={`cs-filter-toggle ${favoritesOnly ? "cs-filter-toggle--active" : ""}`}
          aria-pressed={favoritesOnly}
          onClick={() => setFavoritesOnly((value) => !value)}
        >
          <StudyIcon name="star" /> Favorites
        </button>
      </div>

      <div className="cs-filter-row" aria-label="Action categories">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            className={`cs-filter-chip ${category === item ? "cs-filter-chip--active" : ""}`}
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {visible.length ? (
        <div className="cs-action-grid">
          {visible.map((action) => <ActionCard key={action.id} action={action} />)}
        </div>
      ) : <p className="cs-empty">{actions.length ? "No actions match the current filters." : emptyMessage}</p>}
    </section>
  );
}
