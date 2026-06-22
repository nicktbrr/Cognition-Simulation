"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../utils/supabase";
import AppLayout from "../components/layout/AppLayout";
import SubHeader from "../components/layout/SubHeader";
import AuthLoading from "../components/auth-loading";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import { Input } from "../../components/ui/input";
import Multiselect from "../components/ui/multiselect";
import AnalysisChart from "../components/analysis/AnalysisChart";
import {
  Dataset,
  MetricsData,
  aggregate,
  fetchDatasets,
  loadMetrics,
} from "../utils/analysisData";

interface UserData {
  user_email: string;
  user_id: string;
  pic_url: string;
}

const toOptions = (values: string[]) =>
  values.map((value) => ({ id: value, title: value, description: "" }));

export default function AnalysisPage() {
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useAuth();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loadingDatasets, setLoadingDatasets] = useState(false);

  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const [selectedSteps, setSelectedSteps] = useState<string[]>([]);
  const [selectedMeasures, setSelectedMeasures] = useState<string[]>([]);

  // Options popover state.
  const [showOptions, setShowOptions] = useState(false);
  const [boxWhiskers, setBoxWhiskers] = useState(false);
  const [showValues, setShowValues] = useState(false);
  const [trendline, setTrendline] = useState(false);
  const [yMinInput, setYMinInput] = useState("");
  const [yMaxInput, setYMaxInput] = useState("");
  const optionsRef = useRef<HTMLDivElement>(null);
  const datasetRef = useRef<HTMLDivElement>(null);
  const [showDatasetMenu, setShowDatasetMenu] = useState(false);
  const hasLoadedRef = useRef(false);

  // Redirect unauthenticated users (mirrors other pages' guard via render below).
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isLoading, isAuthenticated, router]);

  const getUserData = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_emails")
      .select("user_email, user_id, pic_url")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("Error fetching user data:", error);
      setUserData(null);
    } else {
      setUserData(data ?? null);
    }
  };

  const loadDatasets = async (userId: string) => {
    setLoadingDatasets(true);
    try {
      const result = await fetchDatasets(userId);
      setDatasets(result);
    } finally {
      setLoadingDatasets(false);
    }
  };

  useEffect(() => {
    if (user && isAuthenticated && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      getUserData(user.user_id);
      loadDatasets(user.user_id);
    } else if (!user || !isAuthenticated) {
      hasLoadedRef.current = false;
    }
  }, [user, isAuthenticated]);

  // Close popovers on outside click.
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
        setShowOptions(false);
      }
      if (datasetRef.current && !datasetRef.current.contains(event.target as Node)) {
        setShowDatasetMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedDataset = useMemo(
    () => datasets.find((d) => d.experimentId === selectedDatasetId) ?? null,
    [datasets, selectedDatasetId]
  );

  const handleSelectDataset = async (dataset: Dataset) => {
    setSelectedDatasetId(dataset.experimentId);
    setShowDatasetMenu(false);
    setMetrics(null);
    setMetricsError(null);
    setSelectedSteps([]);
    setSelectedMeasures([]);
    setLoadingMetrics(true);
    try {
      const data = await loadMetrics(dataset.url, dataset.stepLabels);
      setMetrics(data);
      // Preselect first 3 steps and all measures so a chart renders immediately.
      setSelectedSteps(data.steps.slice(0, 3));
      setSelectedMeasures(data.measures);
    } catch (err) {
      console.error("Error loading metrics:", err);
      setMetricsError(
        err instanceof Error ? err.message : "Could not load this dataset."
      );
    } finally {
      setLoadingMetrics(false);
    }
  };

  const parsedYMin = yMinInput.trim() === "" ? undefined : Number(yMinInput);
  const parsedYMax = yMaxInput.trim() === "" ? undefined : Number(yMaxInput);
  const yMin =
    parsedYMin !== undefined && !Number.isNaN(parsedYMin) ? parsedYMin : undefined;
  const yMax =
    parsedYMax !== undefined && !Number.isNaN(parsedYMax) ? parsedYMax : undefined;

  const chartRows = useMemo(() => {
    if (!metrics) return [];
    return aggregate(metrics, selectedSteps, selectedMeasures);
  }, [metrics, selectedSteps, selectedMeasures]);

  const canShowChart =
    metrics &&
    selectedSteps.length > 0 &&
    selectedMeasures.length > 0 &&
    !loadingMetrics;

  if (isLoading) {
    return <AuthLoading message="Loading analysis..." />;
  }
  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppLayout currentPage="analysis" headerTitle="" userData={userData}>
      <SubHeader
        title="Analysis"
        description="Explore datasets with customizable bar charts."
      />

      <div className="flex-1 overflow-auto bg-gray-100 p-8">
        <Card className="shadow-md">
          <CardContent className="p-6">
            {/* Controls */}
            <div className="flex flex-wrap items-end gap-4">
              {/* Dataset selector */}
              <div className="relative min-w-[220px]" ref={datasetRef}>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Dataset
                </label>
                <button
                  type="button"
                  onClick={() => setShowDatasetMenu((v) => !v)}
                  disabled={loadingDatasets}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm disabled:opacity-50"
                >
                  <span className={selectedDataset ? "text-gray-900" : "text-gray-400"}>
                    {loadingDatasets
                      ? "Loading..."
                      : selectedDataset
                      ? selectedDataset.title
                      : "Select a dataset"}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      showDatasetMenu ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {showDatasetMenu && (
                  <div className="absolute z-[9999] mt-1 max-h-72 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    {datasets.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        No completed datasets yet.
                      </div>
                    ) : (
                      datasets.map((dataset) => (
                        <button
                          key={dataset.experimentId}
                          type="button"
                          onClick={() => handleSelectDataset(dataset)}
                          className={`block w-full px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                            dataset.experimentId === selectedDatasetId
                              ? "bg-blue-50 text-blue-700"
                              : "text-gray-900"
                          }`}
                        >
                          {dataset.title}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Steps (x-axis) */}
              <div className="min-w-[220px]">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Steps (x-axis)
                </label>
                <Multiselect
                  options={toOptions(metrics?.steps ?? [])}
                  selectedValues={selectedSteps}
                  onSelectionChange={setSelectedSteps}
                  placeholder="Select steps"
                  loading={loadingMetrics}
                />
              </div>

              {/* Measures (y-axis) */}
              <div className="min-w-[220px]">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Measures (y-axis)
                </label>
                <Multiselect
                  options={toOptions(metrics?.measures ?? [])}
                  selectedValues={selectedMeasures}
                  onSelectionChange={setSelectedMeasures}
                  placeholder="Select measures"
                  loading={loadingMetrics}
                />
              </div>

              {/* Options popover */}
              <div className="relative" ref={optionsRef}>
                <Button
                  variant="outline"
                  onClick={() => setShowOptions((v) => !v)}
                  className="h-10 gap-2"
                  disabled={!metrics}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Options
                </Button>
                {showOptions && (
                  <div className="absolute z-[9999] mt-1 w-64 rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
                    <ToggleRow
                      label="Box & whiskers"
                      checked={boxWhiskers}
                      onChange={setBoxWhiskers}
                    />
                    <ToggleRow
                      label="Values above bars"
                      checked={showValues}
                      onChange={setShowValues}
                    />
                    <ToggleRow
                      label="Trendline per measure"
                      checked={trendline}
                      onChange={setTrendline}
                    />
                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <p className="mb-1 text-sm font-medium text-gray-700">
                        Y-axis range
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="Min (auto)"
                          value={yMinInput}
                          onChange={(e) => setYMinInput(e.target.value)}
                          className="h-9"
                        />
                        <Input
                          type="number"
                          placeholder="Max (auto)"
                          value={yMaxInput}
                          onChange={(e) => setYMaxInput(e.target.value)}
                          className="h-9"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chart area */}
            <div className="mt-8">
              {!selectedDataset ? (
                <EmptyState
                  message="Select a dataset to start exploring its measures."
                />
              ) : loadingMetrics ? (
                <EmptyState message="Loading dataset..." />
              ) : metricsError ? (
                <EmptyState message={metricsError} />
              ) : metrics && metrics.steps.length === 0 ? (
                <EmptyState message="This dataset has no metric results to display." />
              ) : canShowChart ? (
                <AnalysisChart
                  rows={chartRows}
                  measures={selectedMeasures}
                  showValues={showValues}
                  boxWhiskers={boxWhiskers}
                  trendline={trendline}
                  yMin={yMin}
                  yMax={yMax}
                />
              ) : (
                <EmptyState message="Select at least one step and one measure to render the chart." />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-2 text-sm text-gray-700">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-blue-600" : "bg-gray-300"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-80 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-center">
      <BarChart3 className="mb-3 h-10 w-10 text-gray-300" />
      <p className="max-w-sm text-sm text-gray-500">{message}</p>
    </div>
  );
}
