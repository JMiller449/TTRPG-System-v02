import type { XpTrackerView } from "@/domain/ipc";

export type ProgressionDraft = NonNullable<XpTrackerView["progression"]>;
const attributePattern = /@(?:\{([^{}]+)\}|([A-Za-z_][A-Za-z0-9_]*))/g;
export function previewAttributeIds(expression: string): string[] {
  return [
    ...new Set([...expression.matchAll(attributePattern)].map((match) => match[1] || match[2]))
  ];
}

// Preview-only arithmetic parser. Never executes authored text as JavaScript.
export function previewEquation(text: string, attributes: Record<string, number>): number {
  if (text.length > 1000) throw new Error("Equation is too long.");
  const expression = text.replace(attributePattern, (_, braced: string, plain: string) => {
    const value = attributes[braced || plain];
    if (!Number.isFinite(value))
      throw new Error("Enter sample values for the equation’s Attributes.");
    return `(${value})`;
  });
  const tokens =
    expression.match(
      /(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|\*\*|\/\/|[()+\-*/%,]|[A-Za-z_]+|\S/gi
    ) ?? [];
  if (tokens.length > 300) throw new Error("Equation is too complex.");
  let position = 0;
  const take = (token: string): boolean => tokens[position] === token && Boolean(++position);
  const finite = (value: number): number => {
    if (!Number.isFinite(value)) throw new Error("Equation must produce finite values.");
    return value;
  };
  function atom(): number {
    if (take("(")) {
      const value = sum();
      if (!take(")")) throw new Error("Close the equation’s parentheses.");
      return value;
    }
    const token = tokens[position++];
    if (/^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(token ?? "")) return finite(Number(token));
    if (!["min", "max", "floor", "ceil", "round"].includes(token) || !take("("))
      throw new Error("Use arithmetic, Attributes, min, max, floor, ceil, or round.");
    const args = [sum()];
    while (take(",")) args.push(sum());
    if (!take(")")) throw new Error("Close the function’s parentheses.");
    if (token === "min") return Math.min(...args);
    if (token === "max") return Math.max(...args);
    if (token === "round") {
      const digits = args[1] ?? 0;
      if (args.length > 2 || !Number.isInteger(digits) || Math.abs(digits) > 100)
        throw new Error("Use round(value, whole-number digits). ");
      const scale = 10 ** digits;
      const scaled = args[0] * scale;
      const lower = Math.floor(scaled);
      return finite(
        (scaled - lower === 0.5 ? (lower % 2 === 0 ? lower : lower + 1) : Math.round(scaled)) /
          scale
      );
    }
    if (args.length !== 1) throw new Error(`${token} takes one argument.`);
    return token === "floor" ? Math.floor(args[0]) : Math.ceil(args[0]);
  }
  function power(): number {
    const value = atom();
    return take("**") ? finite(value ** unary()) : value;
  }
  function unary(): number {
    if (take("+")) return unary();
    if (take("-")) return -unary();
    return power();
  }
  function product(): number {
    let value = unary();
    while (["*", "/", "//", "%"].includes(tokens[position])) {
      const operator = tokens[position++];
      const right = unary();
      value = finite(
        operator === "*"
          ? value * right
          : operator === "/"
            ? value / right
            : operator === "//"
              ? Math.floor(value / right)
              : value - Math.floor(value / right) * right
      );
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (["+", "-"].includes(tokens[position])) {
      const operator = tokens[position++];
      const right = product();
      value = finite(operator === "+" ? value + right : value - right);
    }
    return value;
  }
  const value = sum();
  if (position !== tokens.length)
    throw new Error("Check the equation’s operators and parentheses.");
  return finite(value);
}

export type XpPreviewPoint = { level: number; total: number; needed: number };
export class XpPreviewLimitError extends Error {
  constructor(
    public readonly points: XpPreviewPoint[],
    level: number
  ) {
    super(
      `Showing levels 1–${points.length}. Level ${level} exceeds the supported XP range. Reduce the growth multiplier to preview further.`
    );
  }
}

export function buildXpPreview(
  draft: ProgressionDraft,
  levels: number,
  growth: number,
  attributes: Record<string, number> = {}
): { level: number; total: number; needed: number }[] {
  if (
    !Number.isInteger(levels) ||
    levels < 1 ||
    levels > 250 ||
    !Number.isFinite(growth) ||
    growth <= 0
  )
    throw new Error("Enter a positive preview growth rate.");
  const base = Number(draft.base_xp);
  const exponent = Number(draft.growth_exponent);
  const interval = Number(draft.milestone_interval);
  const multiplier = Number(draft.milestone_multiplier);
  const increase = Number(draft.growth_multiplier_per_milestone ?? 1);
  const rounding = draft.mode === "formula" ? 1 : Number(draft.rounding);
  if (
    draft.mode !== "formula" &&
    (![base, exponent, interval, multiplier, rounding, increase].every(Number.isFinite) ||
      increase < 1 ||
      increase > 1000 ||
      base <= 0 ||
      base > 1e12 ||
      exponent <= 0 ||
      exponent > 16 ||
      !Number.isInteger(interval) ||
      interval < 1 ||
      interval > 1e6 ||
      multiplier < 1 ||
      multiplier > 1000 ||
      !Number.isInteger(rounding) ||
      rounding < 1 ||
      rounding > 1e6)
  )
    throw new Error("Enter valid tuning values to preview the curve.");
  let previous = 0;
  const points: XpPreviewPoint[] = [];
  for (let level = 1; level <= levels; level += 1) {
    const raw =
      (draft.mode === "formula"
        ? previewEquation(draft.expression ?? "", { ...attributes, level, xp_growth_rate: growth })
        : base *
          level ** (exponent * increase ** Math.floor(level / interval)) *
          ((level + 1) % interval === 0 ? multiplier : 1)) * growth;
    if (!Number.isFinite(raw) || raw > 1e15) throw new XpPreviewLimitError(points, level);
    if (raw <= 0) throw new Error(`The goal at level ${level} must be positive.`);
    const rounded = Math.max(
      rounding,
      (draft.mode === "formula" ? Math.floor(raw / rounding) : Math.floor(raw / rounding + 0.5)) *
        rounding
    );
    const total = draft.mode === "formula" ? rounded : previous + rounded;
    if (total > 1e15) throw new XpPreviewLimitError(points, level);
    const needed = Math.max(0, total - previous);
    previous = total;
    points.push({ level, total, needed });
  }
  return points;
}
