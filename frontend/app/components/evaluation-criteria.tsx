"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, LockIcon, Trash2, AlertCircle } from "lucide-react";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { isValidURL } from "@/app/utils/urlParser";

/**
 * @interface Criterion
 * @description Defines the structure for an evaluation criterion.
 * @property {string} name - The unique name of the criterion.
 * @property {string} description - A brief explanation of what the criterion measures.
 * @property {boolean} [isDefault] - If true, the criterion is part of the initial set and cannot be deleted.
 */
interface Criterion {
  name: string;
  description: string;
  isDefault?: boolean;
}

/**
 * @const initialCriteria
 * @description A list of pre-defined criteria that are available by default.
 * These are marked with `isDefault: true` to prevent them from being deleted by the user.
 */
const initialCriteria: Criterion[] = [
  {
    name: "Clarity",
    description:
      "The degree to which there are fewer possible interpretations of the text.",
    isDefault: true,
  },
  {
    name: "Fairness",
    description:
      "The degree to which the text is free from bias, favoritism, or injustice.",
    isDefault: true,
  },
  {
    name: "Feasibility",
    description:
      "The degree to which something is solvable, attainable, or achievable.",
    isDefault: true,
  },
  {
    name: "Importance",
    description:
      "The degree to which something is valuable, meaningful, or significant.",
    isDefault: true,
  },
  {
    name: "Novelty",
    description:
      "The degree to which something is unique, original, or distinct.",
    isDefault: true,
  },
  {
    name: "Quality",
    description:
      "The degree to which something is cohesive, coherent, and concise.",
    isDefault: true,
  },
  {
    name: "Usefulness",
    description:
      "The degree to which something is functional, helpful, or practical.",
    isDefault: true,
  },
];

/**
 * @component EvaluationCriteria
 * @description A component that allows users to select from a list of predefined evaluation criteria
 * and define their own custom criteria. It communicates the selected criteria to a parent component.
 * @param {object} props - The component props.
 * @param {function} props.onMetricsChange - A callback function that is invoked when the set of selected criteria changes.
 * @param {boolean} [props.simulationActive=false] - A flag to indicate if a simulation is running. When true, interactions are disabled.
 * @param {function} props.onUrlDetected - A callback to inform the parent component if a URL is detected in the input fields.
 */
export default function EvaluationCriteria({
  onMetricsChange,
  simulationActive = false,
  onUrlDetected,
}: {
  onMetricsChange: (metrics: any[]) => void;
  simulationActive?: boolean;
  onUrlDetected: (hasUrls: boolean) => void;
}) {
  // State for all available criteria, including custom ones added by the user.
  const [criteria, setCriteria] = useState<Criterion[]>(initialCriteria);
  // State for the criteria currently selected by the user.
  const [selectedCriteria, setSelectedCriteria] = useState<Criterion[]>([]);
  // State to control the visibility of the form for adding a new criterion.
  const [showNewCriterionForm, setShowNewCriterionForm] = useState(false);
  // State to hold the data for a new criterion being created by the user.
  const [newCriterion, setNewCriterion] = useState<Criterion>({
    name: "",
    description: "",
  });
  // State to control the visibility of a warning when the custom criteria limit is reached.
  const [showLimitWarning, setShowLimitWarning] = useState(false);
  // State to hold any error message related to URL validation in the new criterion form.
  const [urlError, setUrlError] = useState<string | null>(null);

  // A ref to store the names of the previously selected criteria.
  // This is used to prevent redundant calls to the `onMetricsChange` callback.
  const prevSelectedRef = useRef<string[]>([]);

  // Memoized calculation for the number of custom (non-default) criteria.
  // This avoids recalculating on every render unless the `criteria` state changes.
  const customCriteriaCount = useMemo(
    () => criteria.filter((c) => !c.isDefault).length,
    [criteria]
  );

  // A callback function that shows the custom criteria limit warning for 3 seconds.
  // `useCallback` ensures that the function reference is stable between renders.
  const showTemporaryLimitWarning = useCallback(() => {
    setShowLimitWarning(true);
    setTimeout(() => setShowLimitWarning(false), 3000);
  }, []);

  // This effect hook synchronizes the selected criteria with the parent component.
  // It calls `onMetricsChange` only when the selection has actually changed
  // by comparing the current selection with the values stored in `prevSelectedRef`.
  useEffect(() => {
    const criteriaNames = selectedCriteria.map((criterion) => criterion.name);

    // Only call onMetricsChange if the selection has actually changed
    const prevNames = prevSelectedRef.current;
    const hasChanged =
      prevNames.length !== criteriaNames.length ||
      criteriaNames.some((name, i) => prevNames[i] !== name);

    if (hasChanged) {
      prevSelectedRef.current = criteriaNames;
      onMetricsChange(selectedCriteria);
    }
  }, [selectedCriteria, onMetricsChange]);

  /**
   * Toggles the selection status of a given criterion.
   * If the criterion is already selected, it's removed; otherwise, it's added.
   * This action is disabled if a simulation is active.
   * @param {Criterion} criterion - The criterion to toggle.
   */
  const toggleCriterion = (criterion: Criterion) => {
    if (simulationActive) return; // Prevent toggling if simulation is active

    setSelectedCriteria((prev) => {
      // Check if this criterion is already selected (by name)
      const isSelected = prev.some((c) => c.name === criterion.name);

      if (isSelected) {
        // Remove it if already selected
        return prev.filter((c) => c.name !== criterion.name);
      } else {
        // Add it if not selected
        return [...prev, criterion];
      }
    });
  };

  /**
   * Handles the logic for adding a new custom criterion.
   * It performs validation to ensure the new criterion does not contain URLs
   * and that its name and description are not empty.
   */
  const handleAddCriterion = () => {
    // Check for URLs in both name and description
    if (isValidURL(newCriterion.name)) {
      setUrlError("Criterion name cannot contain URLs");
      return;
    }

    if (isValidURL(newCriterion.description)) {
      setUrlError("Criterion description cannot contain URLs");
      return;
    }

    // Clear any existing URL errors
    setUrlError(null);

    // Validate inputs
    if (!newCriterion.name.trim() || !newCriterion.description.trim()) {
      return;
    }

    const newCriterionObject = { ...newCriterion, isDefault: false };

    // Add new criterion
    setCriteria((prev) => [...prev, newCriterionObject]);

    // Auto-select the newly added criterion
    setSelectedCriteria((prev) => [...prev, newCriterionObject]);

    // Reset form and hide it
    setNewCriterion({ name: "", description: "" });
    setShowNewCriterionForm(false);
  };

  /**
   * Cancels the process of adding a new criterion.
   * It resets the new criterion form and hides it.
   */
  const cancelAddCriterion = () => {
    setNewCriterion({ name: "", description: "" });
    setShowNewCriterionForm(false);
  };

  /**
   * Deletes a custom criterion from the list.
   * Default criteria cannot be deleted. This action is disabled if a simulation is active.
   * @param {string} criterionName - The name of the criterion to delete.
   */
  const deleteCriterion = (criterionName: string) => {
    if (simulationActive) return; // Prevent deletion if simulation is active

    // Remove from criteria list
    setCriteria((prev) => prev.filter((c) => c.name !== criterionName));

    // Remove from selected criteria if selected
    setSelectedCriteria((prev) => prev.filter((c) => c.name !== criterionName));
  };

  /**
   * Handles changes to the new criterion's name input field.
   * It validates the input for URLs and notifies the parent component.
   * @param {string} value - The new value of the name input.
   */
  const handleNameChange = (value: string) => {
    if (isValidURL(value)) {
      setUrlError("URLs are not allowed in criterion name");
      onUrlDetected(true);
    } else {
      setUrlError(null);
      onUrlDetected(false);
    }
    setNewCriterion((prev) => ({ ...prev, name: value }));
  };

  /**
   * Handles changes to the new criterion's description input field.
   * It validates the input for URLs and notifies the parent component.
   * @param {string} value - The new value of the description input.
   */
  const handleDescriptionChange = (value: string) => {
    if (isValidURL(value)) {
      setUrlError("URLs are not allowed in criterion description");
      onUrlDetected(true);
    } else {
      setUrlError(null);
      onUrlDetected(false);
    }
    setNewCriterion((prev) => ({ ...prev, description: value }));
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">
          2. Choose Criteria to Evaluate Steps
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-[#6a03ab] bg-[#6a03ab] text-white hover:bg-[#6a03abe6] hover:text-white"
            onClick={() => {
              if (simulationActive) return;
              setSelectedCriteria([...criteria]);
              onMetricsChange(criteria.map(c => c.name));
            }}
            disabled={simulationActive}
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="border-[#6a03ab] bg-[#6a03ab] text-white hover:bg-[#6a03abe6] hover:text-white"
            onClick={() => {
              if (simulationActive) return;
              setSelectedCriteria([]);
              onMetricsChange([]);
            }}
            disabled={simulationActive}
          >
            Deselect All
          </Button>
          {simulationActive && (
            <div className="flex items-center gap-2">
              <LockIcon className="h-4 w-4" />
              <span className="text-sm">Locked during simulation</span>
            </div>
          )}
        </div>
      </div>
      <p className="text-muted-foreground">
        Select the criteria used to measure the cognitive process above. You can
        also define new criteria.
      </p>

      <div className="flex flex-wrap gap-4">
        {criteria.map((criterion) => (
          <Card
            key={criterion.name}
            className={`w-[200px] p-4 transition-colors relative ${
              selectedCriteria.some((c) => c.name === criterion.name)
                ? "border-primary bg-primary/5"
                : "hover:border-primary/50"
            } ${simulationActive ? "opacity-70" : "cursor-pointer"}`}
          >
            <div
              className="space-y-2"
              onClick={() => toggleCriterion(criterion)}
            >
              <h3 className="font-medium">{criterion.name}</h3>
              <p className="text-sm text-muted-foreground">
                {criterion.description}
              </p>
            </div>

            {/* Renders a delete button for custom (non-default) criteria. */}
            {/* The button is hidden when a simulation is active. */}
            {!criterion.isDefault && !simulationActive && (
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-1 right-1 h-6 w-6 text-red-500 hover:bg-red-100 hover:text-red-700"
                onClick={(e) => {
                  e.stopPropagation(); // Prevent triggering the card's onClick event.
                  deleteCriterion(criterion.name);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </Card>
        ))}

        {/* Renders a button to show the new criterion form. */}
        {/* The button is hidden if the form is already visible or if a simulation is active. */}
        {!showNewCriterionForm && !simulationActive && (
          <div className="relative">
            <Button
              size="icon"
              className="h-[116px] w-[50px]"
              variant="outline"
              onClick={() => {
                if (customCriteriaCount >= 5) {
                  showTemporaryLimitWarning();
                } else {
                  setShowNewCriterionForm(true);
                }
              }}
              disabled={customCriteriaCount >= 5 || simulationActive}
            >
              <Plus className="h-4 w-4" />
            </Button>

            {/* Renders a warning message when the user tries to add more than 5 custom criteria. */}
            {showLimitWarning && (
              <div
                className="absolute top-[-40px] left-1/2 transform -translate-x-1/2 
                bg-amber-100 border border-amber-300 text-amber-800 px-3 py-1 
                rounded-md whitespace-nowrap text-sm shadow-md"
              >
                Maximum of 5 custom criteria allowed
              </div>
            )}
          </div>
        )}
      </div>

      {/* Renders the form for adding a new criterion. */}
      {/* The form is hidden if `showNewCriterionForm` is false or if a simulation is active. */}
      {showNewCriterionForm && !simulationActive && (
        <Card className="p-4 w-full max-w-md">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Add New Criterion</h3>
              <Button size="icon" variant="ghost" onClick={cancelAddCriterion}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Renders an error message if a URL is detected in the input fields. */}
            {urlError && (
              <div className="text-sm text-red-600 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span>{urlError}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="criterionName" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="criterionName"
                placeholder="e.g., Originality"
                value={newCriterion.name}
                maxLength={20}
                onChange={(e) => handleNameChange(e.target.value)}
                className={
                  urlError && isValidURL(newCriterion.name)
                    ? "border-red-500"
                    : ""
                }
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="criterionDescription"
                className="text-sm font-medium"
              >
                Description
              </label>
              <div className="relative">
                <Textarea
                  id="criterionDescription"
                  placeholder="The degree to which..."
                  value={newCriterion.description}
                  maxLength={75}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  rows={3}
                  className={
                    urlError && isValidURL(newCriterion.description)
                      ? "border-red-500"
                      : ""
                  }
                />
                <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
                  {newCriterion.description.length}/75
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={cancelAddCriterion}>
                Cancel
              </Button>
              <Button
                onClick={handleAddCriterion}
                disabled={
                  !!urlError ||
                  !newCriterion.name.trim() ||
                  !newCriterion.description.trim()
                }
              >
                Add Criterion
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Displays a comma-separated list of the names of the selected criteria. */}
      {selectedCriteria.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Selected criteria: {selectedCriteria.map((c) => c.name).join(", ")}
        </p>
      )}
    </section>
  );
}
