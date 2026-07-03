import type { ReactElement } from "react";
import { StudyIcon } from "./StudyIcon";
import type { StatGroupViewModel, SubstatViewModel } from "./types";

function Modifier({ value }: { value?: number }): ReactElement | null {
  if (!value) return null;
  return <span className={`cs-modifier ${value > 0 ? "cs-modifier--up" : "cs-modifier--down"}`}>{value > 0 ? `+${value}` : value}</span>;
}

function SubstatRow({ stat }: { stat: SubstatViewModel }): ReactElement {
  const content = (
    <>
      <span className="cs-substat__copy">
        <span>{stat.label}</span>
        {stat.hint ? <small>{stat.hint}</small> : null}
      </span>
      <span className="cs-substat__number">
        <Modifier value={stat.modifier} />
        <strong>{stat.value}</strong>
        {stat.onRoll ? <StudyIcon name="dice" size={16} /> : null}
      </span>
    </>
  );

  return stat.onRoll ? (
    <button
      type="button"
      className="cs-substat cs-substat--rollable"
      onClick={() => void stat.onRoll?.()}
      disabled={stat.status === "pending"}
      aria-label={`Roll ${stat.label}, current value ${stat.value}`}
    >
      {content}
    </button>
  ) : <div className="cs-substat">{content}</div>;
}

export function StatCluster({ group }: { group: StatGroupViewModel }): ReactElement {
  const value = (
    <>
      <span className="cs-stat-cluster__label">{group.label}</span>
      <span className="cs-stat-cluster__value-line">
        <strong>{group.value}</strong>
        <Modifier value={group.modifier} />
        {group.onRoll ? <StudyIcon name="dice" /> : null}
      </span>
      {group.hint ? <span className="cs-stat-cluster__hint">{group.hint}</span> : null}
    </>
  );

  return (
    <section className="cs-stat-cluster" aria-labelledby={`cs-stat-${group.id}`}>
      {group.onRoll ? (
        <button
          type="button"
          className="cs-stat-cluster__main cs-stat-cluster__main--rollable"
          onClick={() => void group.onRoll?.()}
          disabled={group.status === "pending"}
          aria-label={`Roll ${group.label}, current value ${group.value}`}
        >
          <span id={`cs-stat-${group.id}`}>{value}</span>
        </button>
      ) : <div className="cs-stat-cluster__main" id={`cs-stat-${group.id}`}>{value}</div>}

      <div className="cs-stat-cluster__subs">
        {group.substats.map((stat) => <SubstatRow key={stat.id} stat={stat} />)}
      </div>
    </section>
  );
}
