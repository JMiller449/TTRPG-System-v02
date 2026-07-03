import type { ReactElement } from "react";

export interface ProficiencyRowProps {
  name: string;
  category?: string;
  rank: number | string;
  progress: number;
  bonus?: string;
  note?: string;
}

export function ProficiencyRow({ name, category, rank, progress, bonus, note }: ProficiencyRowProps): ReactElement {
  const safeProgress = Math.min(100, Math.max(0, progress));
  return (
    <article className="r6-proficiency-row">
      <div className="r6-proficiency-row__identity">
        {category ? <p className="r6-kicker">{category}</p> : null}
        <h3>{name}</h3>
        {note ? <p className="r6-muted">{note}</p> : null}
      </div>
      <div className="r6-proficiency-row__rank">
        <span>Rank</span>
        <strong>{rank}</strong>
      </div>
      <div className="r6-proficiency-row__progress">
        <div className="r6-proficiency-row__track" role="progressbar" aria-label={`${name} proficiency progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeProgress}>
          <span style={{ width: `${safeProgress}%` }} />
        </div>
        <span>{safeProgress}% to next rank</span>
      </div>
      {bonus ? <strong className="r6-proficiency-row__bonus">{bonus}</strong> : null}
    </article>
  );
}
