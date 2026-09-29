/**
 * The distribution each sample attribute is drawn from.
 *
 * A categorical attribute splits the sample across its selected values in
 * whole percents that always add up to 100. A continuous attribute (Age and
 * the numeric counts) is a normal curve with a mean and SD, kept within a min
 * and max.
 *
 * The backend builds personas to match these exactly - see
 * `backend/utils/sampling.py`, whose `resolve_distribution` mirrors
 * `ensureDistribution` here so rows saved before distributions existed get
 * the same defaults on both sides.
 */

import { splitEvenly, splitProportion } from "./stepGraph";

export interface CategoricalDistribution {
  type: "categorical";
  /** Whole percent per value label, summing to 100. */
  percentages: Record<string, number>;
}

export interface ContinuousDistribution {
  type: "continuous";
  min: number;
  max: number;
  mean: number;
  sd: number;
}

export type Distribution = CategoricalDistribution | ContinuousDistribution;

/** An attribute as the samples table stores it. */
export interface SampleAttributeJson {
  label: string;
  category: string;
  values: string[];
  distribution?: Distribution;
}

const roundTo1 = (value: number) => Math.round(value * 10) / 10;

/** A default SD that keeps nearly the whole curve (±3 SD) inside the range. */
export const defaultSd = (min: number, max: number) => roundTo1((max - min) / 6);

export const defaultContinuous = (min: number, max: number): ContinuousDistribution => ({
  type: "continuous",
  min,
  max,
  mean: roundTo1((min + max) / 2),
  sd: defaultSd(min, max),
});

/** True when mean and SD are still the defaults for the min and max. */
export const isDefaultShape = (d: ContinuousDistribution) => {
  const fallback = defaultContinuous(d.min, d.max);
  return d.mean === fallback.mean && d.sd === fallback.sd;
};

export const defaultCategorical = (values: string[]): CategoricalDistribution => {
  const parts = splitEvenly(100, values.length);
  return {
    type: "categorical",
    percentages: Object.fromEntries(values.map((value, i) => [value, parts[i]])),
  };
};

/**
 * Fit a categorical split to a new set of values. Values that were already
 * there keep their relative share and new values come in at an even share;
 * the result is re-rounded to whole percents that sum to 100.
 */
export function rebalanceCategorical(
  distribution: Distribution | undefined,
  values: string[]
): CategoricalDistribution {
  const previous = distribution?.type === "categorical" ? distribution.percentages : {};
  const evenShare = values.length > 0 ? 100 / values.length : 0;
  const weights = values.map((value) =>
    typeof previous[value] === "number" && Number.isFinite(previous[value])
      ? Math.max(0, previous[value])
      : evenShare
  );
  const parts = splitProportion(100, weights);
  return {
    type: "categorical",
    percentages: Object.fromEntries(values.map((value, i) => [value, parts[i]])),
  };
}

/**
 * Set one value's percent and re-split the rest.
 *
 * The edited value joins `pinned`; pinned values keep what the user typed and
 * the unpinned ones share whatever is left, in proportion to their current
 * shares. If every other value is pinned they are all re-split so the total
 * can still reach 100.
 */
export function setCategoricalPercent(
  distribution: CategoricalDistribution,
  values: string[],
  label: string,
  percent: number,
  pinned: Set<string>
): CategoricalDistribution {
  const others = values.filter((value) => value !== label);
  let free = others.filter((value) => !pinned.has(value));
  if (free.length === 0) free = others;
  const fixed = others.filter((value) => !free.includes(value));

  const claimedByFixed = fixed.reduce((sum, value) => sum + (distribution.percentages[value] ?? 0), 0);
  const edited = Math.max(0, Math.min(100 - claimedByFixed, Math.round(percent)));
  const shares = splitProportion(
    100 - claimedByFixed - edited,
    free.map((value) => distribution.percentages[value] ?? 0)
  );

  const percentages: Record<string, number> = {};
  for (const value of values) {
    if (value === label) percentages[value] = edited;
    else if (fixed.includes(value)) percentages[value] = distribution.percentages[value] ?? 0;
    else percentages[value] = shares[free.indexOf(value)];
  }
  return { type: "categorical", percentages };
}

/** Pull [min, max] out of a stored range like "18 - 35 years old". */
export function parseRange(value: string | undefined): [number, number] | null {
  const match = value?.match(/(\d+)\s*-\s*(\d+)/);
  if (!match) return null;
  const a = parseInt(match[1], 10);
  const b = parseInt(match[2], 10);
  return [Math.min(a, b), Math.max(a, b)];
}

/** The range string stored in `values` for a continuous attribute. */
export const formatRange = (min: number, max: number, unit?: string) =>
  `${min} - ${max}${unit ? ` ${unit}` : ""}`;

/**
 * The distribution for a stored attribute, with the defaults filled in for
 * rows saved before distributions existed: an even split, or for a legacy
 * Age range a normal curve centred in it.
 */
export function ensureDistribution(attribute: SampleAttributeJson): Distribution {
  const values = attribute.values || [];
  const stored = attribute.distribution;

  if (stored?.type === "continuous") return stored;

  if (!stored && attribute.label === "Age") {
    const range = parseRange(values[0]);
    if (range) return defaultContinuous(range[0], range[1]);
  }

  return rebalanceCategorical(stored, values);
}

export interface Bounds {
  min: number;
  max: number;
}

/** Why a continuous distribution can't be used, or null when it is fine. */
export function validateContinuous(d: ContinuousDistribution, bounds?: Bounds): string | null {
  if ([d.min, d.max, d.mean, d.sd].some((value) => !Number.isFinite(value))) {
    return "Enter a number for min, max, mean and SD.";
  }
  if (bounds && (d.min < bounds.min || d.max > bounds.max)) {
    return `Min and max must be between ${bounds.min} and ${bounds.max}.`;
  }
  if (d.min >= d.max) return "Min must be less than max.";
  if (d.mean < d.min || d.mean > d.max) return "Mean must be between min and max.";
  if (d.sd < 0) return "SD can't be negative.";
  return null;
}

/** One-line summary, e.g. "18–82 · mean 50 · SD 10.7". */
export const formatContinuous = (d: ContinuousDistribution, unit?: string) =>
  `${d.min}–${d.max}${unit ? ` ${unit}` : ""} · mean ${d.mean} · SD ${d.sd}`;
