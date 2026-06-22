"use client";

import React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ErrorBar,
  Legend,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartRow, errKey, statKey, trendKey } from "../../utils/analysisData";

// Palette echoes the mockup (blue / green / orange) then cycles for extras.
const COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#8b5cf6",
  "#ef4444",
  "#14b8a6",
];

interface AnalysisChartProps {
  rows: ChartRow[];
  measures: string[];
  showValues: boolean;
  boxWhiskers: boolean;
  trendline: boolean;
  yMin?: number;
  yMax?: number;
}

interface TooltipEntry {
  dataKey?: string | number;
  name?: string;
  value?: number;
  color?: string;
  payload?: ChartRow;
}

function CustomTooltip({
  active,
  payload,
  label,
  measures,
  colorOf,
  boxWhiskers,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  measures: string[];
  colorOf: (measure: string) => string;
  boxWhiskers: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;

  // Use the bar (mean) series only; skip hidden trend/error series.
  const meanEntries = payload.filter(
    (entry) => typeof entry.dataKey === "string" && measures.includes(entry.dataKey)
  );
  if (meanEntries.length === 0) return null;
  const row = meanEntries[0].payload;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md">
      <p className="mb-1 text-sm font-semibold text-gray-900">{label}</p>
      {meanEntries.map((entry) => {
        const measure = entry.dataKey as string;
        const color = colorOf(measure);
        return (
          <div key={measure} className="text-sm" style={{ color }}>
            <span>
              {measure} : {entry.value}
            </span>
            {boxWhiskers && row && (
              <span className="ml-1 text-xs text-gray-500">
                (min {row[statKey(measure, "min")]} · Q1 {row[statKey(measure, "q1")]} · med{" "}
                {row[statKey(measure, "median")]} · Q3 {row[statKey(measure, "q3")]} · max{" "}
                {row[statKey(measure, "max")]})
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AnalysisChart({
  rows,
  measures,
  showValues,
  boxWhiskers,
  trendline,
  yMin,
  yMax,
}: AnalysisChartProps) {
  const colorOf = (measure: string) => COLORS[measures.indexOf(measure) % COLORS.length];

  // Auto Y-domain ignores error bars, so widen the top to fit whiskers when
  // box & whiskers is on and the user hasn't pinned an explicit max.
  let autoTop: number | "auto" = "auto";
  if (boxWhiskers && yMax === undefined) {
    let max = 0;
    for (const row of rows) {
      for (const measure of measures) {
        const m = row[statKey(measure, "max")];
        if (typeof m === "number" && m > max) max = m;
      }
    }
    if (max > 0) autoTop = Math.ceil(max * 1.05);
  }
  const domain: [number | "auto", number | "auto"] = [
    yMin ?? "auto",
    yMax ?? autoTop,
  ];

  return (
    <ResponsiveContainer width="100%" height={400}>
      <ComposedChart data={rows} margin={{ top: 24, right: 16, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
        <XAxis dataKey="step" tick={{ fontSize: 12 }} />
        <YAxis domain={domain} allowDataOverflow tick={{ fontSize: 12 }} />
        <Tooltip
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
          content={
            <CustomTooltip
              measures={measures}
              colorOf={colorOf}
              boxWhiskers={boxWhiskers}
            />
          }
        />
        <Legend
          payload={measures.map((measure) => ({
            value: measure,
            type: "square",
            id: measure,
            color: colorOf(measure),
          }))}
        />
        {measures.map((measure) => {
          const color = colorOf(measure);
          return (
            <Bar key={measure} dataKey={measure} fill={color} radius={[2, 2, 0, 0]}>
              {boxWhiskers && (
                <ErrorBar
                  dataKey={errKey(measure)}
                  width={5}
                  strokeWidth={1.5}
                  stroke="#374151"
                  direction="y"
                />
              )}
              {showValues && (
                <LabelList
                  dataKey={measure}
                  position="top"
                  style={{ fontSize: 11, fill: "#374151" }}
                />
              )}
            </Bar>
          );
        })}
        {trendline &&
          measures.map((measure) => (
            <Line
              key={`trend-${measure}`}
              type="linear"
              dataKey={trendKey(measure)}
              stroke={colorOf(measure)}
              strokeWidth={2}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
              legendType="none"
              isAnimationActive={false}
            />
          ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
