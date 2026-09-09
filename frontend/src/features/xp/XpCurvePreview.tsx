import { useId, useState } from "react";
import { Field } from "@/shared/ui/Field";
import {
  buildXpPreview,
  XpPreviewLimitError,
  previewAttributeIds,
  type ProgressionDraft
} from "./xpCurvePreviewMath";

const shortNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
export function XpCurvePreview({ draft }: { draft: ProgressionDraft }): JSX.Element {
  const [levels, setLevels] = useState(50);
  const [growth, setGrowth] = useState(1);
  const [metric, setMetric] = useState<"needed" | "total">("needed");
  const [selected, setSelected] = useState(1);
  const [samples, setSamples] = useState<Record<string, number>>({});
  const titleId = useId();
  const attributeIds =
    draft.mode === "formula"
      ? previewAttributeIds(draft.expression ?? "").filter(
          (id) => id !== "level" && id !== "xp_growth_rate"
        )
      : [];
  let points: ReturnType<typeof buildXpPreview> = [];
  let error = "";
  try {
    points = buildXpPreview(draft, levels, growth, samples);
  } catch (reason) {
    if (reason instanceof XpPreviewLimitError) points = reason.points;
    error = reason instanceof Error ? reason.message : "Check the preview values.";
  }
  const displayedLevels = points.length;
  const active = points[Math.min(selected, displayedLevels) - 1];
  const maximum = Math.max(1, ...points.map((point) => point[metric]));
  const x = (level: number): number => 64 + ((level - 1) / Math.max(1, displayedLevels - 1)) * 512;
  const y = (value: number): number => 236 - (value / maximum) * 208;
  const line = points.map((point) => `${x(point.level)},${y(point[metric])}`).join(" ");
  return (
    <section className="xp-curve" aria-labelledby={titleId}>
      <header className="xp-curve__header">
        <div>
          <h4 id={titleId}>Leveling curve</h4>
          <span className="xp-curve__caption">Live preview · unsaved settings</span>
        </div>
        <select
          aria-label="Graph measure"
          value={metric}
          onChange={(event) => setMetric(event.target.value as typeof metric)}
        >
          <option value="needed">XP per level</option>
          <option value="total">Lifetime XP target</option>
        </select>
      </header>
      <div className="xp-curve__controls">
        <Field label="Preview through">
          <select value={levels} onChange={(event) => setLevels(Number(event.target.value))}>
            {[25, 50, 100, 250].map((level) => (
              <option key={level} value={level}>
                Level {level}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Preview growth rate">
          <input
            type="number"
            min="0.01"
            step="any"
            value={Number.isNaN(growth) ? "" : growth}
            onChange={(event) =>
              setGrowth(event.target.value === "" ? NaN : Number(event.target.value))
            }
          />
        </Field>
      </div>
      {attributeIds.length > 0 ? (
        <details open className="xp-curve__samples">
          <summary>Sample Attribute values</summary>
          <div className="xp-curve__controls">
            {attributeIds.map((id) => (
              <Field key={id} label={id}>
                <input
                  type="number"
                  step="any"
                  value={Number.isNaN(samples[id]) ? "" : (samples[id] ?? "")}
                  onChange={(event) =>
                    setSamples({
                      ...samples,
                      [id]: event.target.value === "" ? NaN : Number(event.target.value)
                    })
                  }
                />
              </Field>
            ))}
          </div>
        </details>
      ) : null}
      {error && points.length > 0 ? (
        <p className="xp-curve__caption" role="status">
          {error}
        </p>
      ) : null}
      {points.length === 0 ? (
        <div className="xp-curve__empty" role="status">
          {error}
        </div>
      ) : (
        <>
          <svg
            viewBox="0 0 600 272"
            role="img"
            aria-label={`${metric === "needed" ? "XP needed per level" : "Lifetime XP targets"}, levels 1 to ${displayedLevels}`}
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const level =
                Math.round(
                  ((((event.clientX - bounds.left) / bounds.width) * 600 - 64) / 512) *
                    Math.max(1, displayedLevels - 1)
                ) + 1;
              setSelected(Math.max(1, Math.min(displayedLevels, level)));
            }}
          >
            {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
              <g key={fraction} className="xp-curve__grid">
                <line x1="64" x2="576" y1={y(maximum * fraction)} y2={y(maximum * fraction)} />
                <text x="54" y={y(maximum * fraction) + 4} textAnchor="end">
                  {shortNumber.format(maximum * fraction)}
                </text>
              </g>
            ))}
            {[...new Set([1, Math.max(1, Math.round(displayedLevels / 2)), displayedLevels])].map(
              (level) => (
                <text
                  className="xp-curve__axis"
                  key={level}
                  x={x(level)}
                  y="260"
                  textAnchor="middle"
                >
                  {level}
                </text>
              )
            )}
            <polygon className="xp-curve__area" points={`64,236 ${line} 576,236`} />
            <polyline className="xp-curve__line" points={line} />
            {active ? (
              <g>
                <line
                  className="xp-curve__cursor"
                  x1={x(active.level)}
                  x2={x(active.level)}
                  y1="28"
                  y2="236"
                />
                <circle
                  className="xp-curve__dot"
                  cx={x(active.level)}
                  cy={y(active[metric])}
                  r="4"
                />
              </g>
            ) : null}
          </svg>
          <div className="xp-curve__readout" aria-live="polite">
            <strong>
              Level {active?.level} → {(active?.level ?? 1) + 1}
            </strong>
            <span>{active?.needed.toLocaleString()} XP needed</span>
            <span>{active?.total.toLocaleString()} lifetime XP</span>
          </div>
          <input
            aria-label="Inspect level"
            type="range"
            min="1"
            max={displayedLevels}
            value={Math.min(selected, displayedLevels)}
            onChange={(event) => setSelected(Number(event.target.value))}
          />
        </>
      )}
      <p className="xp-curve__caption">
        XP per level is the increase between lifetime targets, holding sample Attributes fixed.
        Preview only; saved character goals come from the server.
      </p>
    </section>
  );
}
