"use client";

import React, { useEffect, useState } from "react";
import {
  defaultCategorical,
  defaultContinuous,
  isDefaultShape,
  setCategoricalPercent,
  validateContinuous,
  type Bounds,
  type CategoricalDistribution,
  type ContinuousDistribution,
  type Distribution,
} from "../utils/distributions";

const NUMBER_INPUT_CLASS =
  "w-16 px-2 py-1 text-sm text-right border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/**
 * A number box that holds exactly what is typed while it has focus - an
 * empty box stays empty rather than snapping back - and hands a value up
 * only once it parses. `commitOnBlur` defers that until the box is left, for
 * edits that re-split other values.
 */
function NumberField({
  value,
  onCommit,
  step = 1,
  commitOnBlur = false,
  ariaLabel,
  className = NUMBER_INPUT_CLASS,
}: {
  value: number;
  onCommit: (value: number) => void;
  step?: number;
  commitOnBlur?: boolean;
  ariaLabel: string;
  className?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  useEffect(() => {
    // A change from elsewhere (a re-split) wins over a stale draft.
    if (!commitOnBlur) return;
    setDraft(null);
  }, [value, commitOnBlur]);

  const parse = (raw: string) => (step === 1 ? parseInt(raw, 10) : parseFloat(raw));
  const commit = (raw: string) => {
    const parsed = parse(raw);
    if (!Number.isNaN(parsed) && parsed !== value) onCommit(parsed);
  };

  return (
    <input
      type="number"
      step={step}
      aria-label={ariaLabel}
      value={draft ?? String(value)}
      onChange={(event) => {
        setDraft(event.target.value);
        if (!commitOnBlur) commit(event.target.value);
      }}
      onFocus={(event) => event.target.select()}
      onBlur={(event) => {
        if (commitOnBlur) commit(event.target.value);
        setDraft(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
      }}
      className={className}
    />
  );
}

function CategoricalEditor({
  values,
  distribution,
  onChange,
}: {
  values: string[];
  distribution: CategoricalDistribution;
  onChange: (distribution: CategoricalDistribution) => void;
}) {
  // Values the user typed a percent for keep it while the others re-split.
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const valuesKey = values.join("\u0000");
  useEffect(() => {
    setPinned((prev) => new Set([...prev].filter((value) => values.includes(value))));
    // Keyed on the labels rather than the array, which is rebuilt each render.
  }, [valuesKey]);

  const total = values.reduce((sum, value) => sum + (distribution.percentages[value] ?? 0), 0);

  return (
    <div className="space-y-1.5">
      {values.map((value) => (
        <div key={value} className="flex items-center justify-between gap-2 text-sm text-gray-900">
          <span className="truncate" title={value}>{value}</span>
          <span className="flex flex-shrink-0 items-center gap-1">
            <NumberField
              ariaLabel={`Percent of sample: ${value}`}
              value={distribution.percentages[value] ?? 0}
              commitOnBlur
              onCommit={(percent) => {
                const nextPinned = new Set(pinned).add(value);
                setPinned(nextPinned);
                onChange(setCategoricalPercent(distribution, values, value, percent, nextPinned));
              }}
            />
            <span className="text-gray-500">%</span>
          </span>
        </div>
      ))}
      {values.length > 1 && (
        <div className="flex items-center justify-between pt-1 text-xs">
          <span className={total === 100 ? "text-gray-500" : "text-red-600"}>Total: {total}%</span>
          <button
            type="button"
            onClick={() => {
              setPinned(new Set());
              onChange(defaultCategorical(values));
            }}
            className="text-blue-600 hover:text-blue-800"
          >
            Reset to even
          </button>
        </div>
      )}
    </div>
  );
}

const CONTINUOUS_FIELDS: Array<{ key: keyof Omit<ContinuousDistribution, "type">; label: string; step: number }> = [
  { key: "min", label: "Min", step: 1 },
  { key: "max", label: "Max", step: 1 },
  { key: "mean", label: "Mean", step: 0.1 },
  { key: "sd", label: "SD", step: 0.1 },
];

function ContinuousEditor({
  distribution,
  onChange,
  bounds,
  unit,
}: {
  distribution: ContinuousDistribution;
  onChange: (distribution: ContinuousDistribution) => void;
  bounds?: Bounds;
  unit?: string;
}) {
  // Until the user sets the mean or SD themselves, they follow min and max.
  const [shapeEdited, setShapeEdited] = useState(() => !isDefaultShape(distribution));
  const error = validateContinuous(distribution, bounds);

  const update = (key: keyof Omit<ContinuousDistribution, "type">, value: number) => {
    if (key === "mean" || key === "sd") {
      setShapeEdited(true);
      onChange({ ...distribution, [key]: value });
      return;
    }
    const next = { ...distribution, [key]: value };
    onChange(shapeEdited || next.min >= next.max ? next : defaultContinuous(next.min, next.max));
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {CONTINUOUS_FIELDS.map(({ key, label, step }) => (
          <label key={key} className="flex items-center justify-between gap-2 text-sm text-gray-700">
            <span>{label}</span>
            <NumberField
              ariaLabel={label}
              value={distribution[key]}
              step={step}
              onCommit={(value) => update(key, value)}
            />
          </label>
        ))}
      </div>
      {unit && <div className="text-xs text-gray-500">Values in {unit}.</div>}
      {bounds && !error && (
        <div className="text-xs text-gray-500">Allowed range {bounds.min}–{bounds.max}.</div>
      )}
      {error && (
        <div className="text-xs text-red-600 px-2 py-1 rounded-md border border-red-300 bg-red-50">{error}</div>
      )}
    </div>
  );
}

interface DistributionEditorProps {
  /** The selected value labels (categorical only). */
  values: string[];
  distribution: Distribution;
  onChange: (distribution: Distribution) => void;
  /** The widest range a continuous attribute may take. */
  bounds?: Bounds;
  unit?: string;
}

/**
 * Edit how the sample is spread over an attribute: a whole-number percent per
 * selected value, or min / max / mean / SD for a continuous attribute.
 */
export default function DistributionEditor({
  values,
  distribution,
  onChange,
  bounds,
  unit,
}: DistributionEditorProps) {
  if (distribution.type === "continuous") {
    return (
      <ContinuousEditor
        distribution={distribution}
        onChange={onChange}
        bounds={bounds}
        unit={unit}
      />
    );
  }
  return (
    <CategoricalEditor values={values} distribution={distribution} onChange={onChange} />
  );
}
