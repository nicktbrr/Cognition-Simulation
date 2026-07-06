"use client";

import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { measureColor } from "../../utils/analysisData";
import {
  AnovaResult,
  TTestResult,
  anova,
  getPairCombinations,
  tTest,
} from "../../utils/statistics";

export interface SelectedBar {
  step: string;
  measure: string;
  values: number[];
}

interface ComparePanelProps {
  selected: SelectedBar[];
  /** Selected measures, in order — drives each bar's accent color. */
  measures: string[];
  onClear: () => void;
}

const barLabel = (b: SelectedBar) => `${b.measure} · ${b.step}`;

type TestState =
  | { kind: "none" }
  | { kind: "t-test"; results: PairResult[]; pairwise: boolean }
  | { kind: "anova"; result: AnovaResult; groupNames: string[] };

interface PairResult {
  group1: string;
  group2: string;
  result: TTestResult;
  significant: boolean;
  significantBonferroni?: boolean;
}

export default function ComparePanel({ selected, measures, onClear }: ComparePanelProps) {
  const [test, setTest] = useState<TestState>({ kind: "none" });

  // Any change to the selection invalidates previously computed results.
  useEffect(() => {
    setTest({ kind: "none" });
  }, [selected]);

  const ready = selected.length >= 2;
  const colorFor = (b: SelectedBar) => measureColor(b.measure, measures);

  const runTTest = () => {
    if (!ready) return;
    const pairs = getPairCombinations(selected);
    const bonferroniAlpha = 0.05 / pairs.length;
    const results: PairResult[] = pairs.map(([a, b]) => {
      const result = tTest(a.values, b.values);
      return {
        group1: barLabel(a),
        group2: barLabel(b),
        result,
        significant: result.pValue < 0.05,
        significantBonferroni: result.pValue < bonferroniAlpha,
      };
    });
    setTest({ kind: "t-test", results, pairwise: selected.length > 2 });
  };

  const runAnova = () => {
    if (!ready) return;
    const result = anova(selected.map((s) => s.values));
    setTest({ kind: "anova", result, groupNames: selected.map(barLabel) });
  };

  const exportCSV = () => {
    const csv = buildCSV(test);
    if (!csv) return;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${test.kind}_results.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-800">
          Selected bars for comparison
        </span>
        <span className="text-xs text-gray-500">
          {selected.length === 0
            ? "Click bars in the chart to select them"
            : selected.length === 1
            ? "Select at least one more bar to compare"
            : `${selected.length} bars selected — ready for analysis`}
        </span>
      </div>

      {/* Selected bar cards */}
      <div className="mb-4 flex flex-wrap gap-3">
        {selected.map((b, i) => {
          const m = b.values.length ? mean(b.values) : 0;
          return (
            <div
              key={barLabel(b)}
              className="min-w-[150px] max-w-[220px] flex-1 rounded-md border border-gray-200 bg-white p-3"
            >
              <div className="mb-1 text-xs text-gray-500">
                Bar {i + 1}: {b.measure} ({b.step}) · n = {b.values.length}
              </div>
              <div
                className="text-xl font-semibold"
                style={{ color: colorFor(b) }}
              >
                {m.toFixed(2)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Test buttons */}
      <div className="mb-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={runTTest}
          disabled={!ready}
          title={selected.length > 2 ? "Runs pairwise t-tests for all combinations" : ""}
          className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Run t-Test
        </button>
        <button
          type="button"
          onClick={runAnova}
          disabled={!ready}
          className="rounded-md bg-green-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Run ANOVA
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={selected.length === 0}
          className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X className="h-4 w-4" />
          Clear selection
        </button>
      </div>

      {test.kind !== "none" && (
        <div className="rounded-md border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-800">
              {test.kind === "anova"
                ? `One-Way ANOVA Results (${selected.length} groups)`
                : test.pairwise
                ? `Pairwise t-Tests (${test.results.length} comparisons)`
                : "Independent Samples t-Test Results"}
            </div>
            <button
              type="button"
              onClick={exportCSV}
              className="flex items-center gap-1 rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>

          {test.kind === "t-test" && !test.pairwise && (
            <SingleTTest pair={test.results[0]} />
          )}
          {test.kind === "t-test" && test.pairwise && (
            <PairwiseTTest results={test.results} />
          )}
          {test.kind === "anova" && (
            <AnovaTable result={test.result} groupNames={test.groupNames} />
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- result renderers ---------- */

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between border-b border-gray-100 py-2 text-sm last:border-none">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{children}</span>
    </div>
  );
}

function sigClass(significant: boolean) {
  return significant ? "text-green-600" : "text-red-600";
}

function Interpretation({
  significant,
  children,
}: {
  significant: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mt-3 rounded-md border-l-[3px] p-3 text-sm ${
        significant
          ? "border-green-500 bg-green-50 text-green-800"
          : "border-amber-500 bg-amber-50 text-amber-800"
      }`}
    >
      {children}
    </div>
  );
}

function SingleTTest({ pair }: { pair: PairResult }) {
  const { result, group1, group2, significant } = pair;
  const delta = Math.abs(result.mean1 - result.mean2);
  return (
    <>
      <Row label={`Group 1 (${group1})`}>
        M = {result.mean1.toFixed(2)}, SD = {result.sd1.toFixed(2)}
      </Row>
      <Row label={`Group 2 (${group2})`}>
        M = {result.mean2.toFixed(2)}, SD = {result.sd2.toFixed(2)}
      </Row>
      <Row label="t-statistic">{result.tStatistic.toFixed(4)}</Row>
      <Row label="Degrees of freedom">{result.degreesOfFreedom}</Row>
      <Row label="p-value">
        <span className={sigClass(significant)}>{result.pValue.toFixed(4)}</span>
      </Row>
      <Interpretation significant={significant}>
        {significant ? (
          <>
            <strong>Statistically significant (p &lt; 0.05)</strong>
            <br />
            The difference between the two groups is statistically significant. The
            mean difference of {delta.toFixed(2)} is unlikely to have occurred by
            chance.
          </>
        ) : (
          <>
            <strong>Not statistically significant (p ≥ 0.05)</strong>
            <br />
            There is insufficient evidence to conclude that the two groups differ
            significantly.
          </>
        )}
      </Interpretation>
    </>
  );
}

function PairwiseTTest({ results }: { results: PairResult[] }) {
  const bonferroniAlpha = 0.05 / results.length;
  const significantCount = results.filter((r) => r.significant).length;
  const bonferroniCount = results.filter((r) => r.significantBonferroni).length;
  return (
    <>
      <div className="mb-3 flex max-h-[300px] flex-col gap-2 overflow-y-auto">
        {results.map((p, idx) => (
          <div
            key={`${p.group1}|${p.group2}`}
            className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
          >
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-800">
                Comparison {idx + 1}: {p.group1} vs {p.group2}
              </span>
              <span
                className={`rounded px-2 py-0.5 text-xs font-semibold ${
                  p.significant
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {p.significant ? "✓ Sig." : "✗ N.S."}
              </span>
            </div>
            <div className="flex gap-4 text-xs text-gray-500">
              <span>t = {p.result.tStatistic.toFixed(3)}</span>
              <span>df = {p.result.degreesOfFreedom}</span>
              <span className={sigClass(p.significant)}>
                p = {p.result.pValue.toFixed(4)}
              </span>
              <span>ΔM = {Math.abs(p.result.mean1 - p.result.mean2).toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
      <Interpretation significant={significantCount > 0}>
        <strong>Summary:</strong> {significantCount} of {results.length} comparisons
        significant at p &lt; 0.05
        <br />
        <strong>Bonferroni correction (α = {bonferroniAlpha.toFixed(4)}):</strong>{" "}
        {bonferroniCount} comparisons remain significant
      </Interpretation>
    </>
  );
}

function AnovaTable({
  result,
  groupNames,
}: {
  result: AnovaResult;
  groupNames: string[];
}) {
  const significant = result.pValue < 0.05;
  const effect =
    result.etaSquared < 0.06 ? "small" : result.etaSquared < 0.14 ? "medium" : "large";
  return (
    <>
      {result.groupStats.map((g, i) => (
        <Row key={groupNames[i]} label={`Group ${i + 1} (${groupNames[i]})`}>
          M = {g.mean.toFixed(2)}, n = {g.n}
        </Row>
      ))}
      <div className="mt-2 border-t-2 border-gray-200 pt-1">
        <Row label="Between-group SS">{result.SSB.toFixed(4)}</Row>
      </div>
      <Row label="Within-group SS">{result.SSW.toFixed(4)}</Row>
      <Row label="Total SS">{result.SST.toFixed(4)}</Row>
      <Row label="Mean square between">{result.MSB.toFixed(4)}</Row>
      <Row label="Mean square within">{result.MSW.toFixed(4)}</Row>
      <Row label="F-statistic">{result.fStatistic.toFixed(4)}</Row>
      <Row label="df (between, within)">
        ({result.dfBetween}, {result.dfWithin})
      </Row>
      <Row label="p-value">
        <span className={sigClass(significant)}>{result.pValue.toFixed(4)}</span>
      </Row>
      <Row label="Effect size (η²)">
        {result.etaSquared.toFixed(4)} ({effect})
      </Row>
      <Interpretation significant={significant}>
        {significant ? (
          <>
            <strong>Statistically significant (p &lt; 0.05)</strong>
            <br />
            The ANOVA indicates a significant difference among the{" "}
            {result.groupStats.length} groups.{" "}
            {result.groupStats.length > 2
              ? "Post-hoc tests would be needed to determine which specific groups differ."
              : ""}
          </>
        ) : (
          <>
            <strong>Not statistically significant (p ≥ 0.05)</strong>
            <br />
            The ANOVA indicates no significant difference among the groups.
          </>
        )}
      </Interpretation>
    </>
  );
}

/* ---------- helpers ---------- */

function mean(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function buildCSV(test: TestState): string {
  if (test.kind === "t-test") {
    let csv =
      "Group 1,Group 2,Mean 1,SD 1,Mean 2,SD 2,t-statistic,df,p-value,Significant (p<0.05)";
    if (test.pairwise) csv += ",Significant (Bonferroni)";
    csv += "\n";
    for (const r of test.results) {
      csv +=
        `"${r.group1}","${r.group2}",${r.result.mean1.toFixed(4)},${r.result.sd1.toFixed(4)},` +
        `${r.result.mean2.toFixed(4)},${r.result.sd2.toFixed(4)},${r.result.tStatistic.toFixed(4)},` +
        `${r.result.degreesOfFreedom},${r.result.pValue.toFixed(6)},${r.significant ? "Yes" : "No"}`;
      if (test.pairwise) csv += `,${r.significantBonferroni ? "Yes" : "No"}`;
      csv += "\n";
    }
    return csv;
  }

  if (test.kind === "anova") {
    const r = test.result;
    let csv = "ANOVA Results\n\nGroup Statistics\nGroup,Mean,N\n";
    r.groupStats.forEach((g, i) => {
      csv += `"${test.groupNames[i]}",${g.mean.toFixed(4)},${g.n}\n`;
    });
    csv += "\nANOVA Table\nSource,SS,df,MS,F,p-value\n";
    csv += `Between Groups,${r.SSB.toFixed(4)},${r.dfBetween},${r.MSB.toFixed(4)},${r.fStatistic.toFixed(4)},${r.pValue.toFixed(6)}\n`;
    csv += `Within Groups,${r.SSW.toFixed(4)},${r.dfWithin},${r.MSW.toFixed(4)},,\n`;
    csv += `Total,${r.SST.toFixed(4)},${r.dfBetween + r.dfWithin},,,\n`;
    csv += `\nEffect Size (eta-squared),${r.etaSquared.toFixed(4)}\n`;
    return csv;
  }

  return "";
}
