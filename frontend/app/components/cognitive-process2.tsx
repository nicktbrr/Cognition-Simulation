"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import CognitiveFlow from "./cognitive-flow";
import { isValidURL } from "@/app/utils/urlParser";

interface Step {
  id: number;
  label: string;
  instructions: string;
  temperature: number;
}

// Define Edge interface to match the one in Home component
interface Edge {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
  animated?: boolean;
  style?: any;
  markerEnd?: any;
}

export default function CognitiveProcess2({
  onStepsChange,
  onTemperatureChange,
  edges = [],
  onEdgesChange,
  simulationActive = false,
}: {
  onStepsChange: (steps: Step[]) => void;
  onTemperatureChange: (temperature: number) => void;
  edges?: Edge[];
  onEdgesChange?: (edges: Edge[]) => void;
  simulationActive?: boolean;
}) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [urlWarnings, setUrlWarnings] = useState<{ [key: number]: string[] }>(
    {}
  );

  const handleStepsChange = (updatedSteps: Step[]) => {
    // Check each step for URLs
    const warnings: { [key: number]: string[] } = {};

    updatedSteps.forEach((step) => {
      const stepWarnings: string[] = [];

      if (isValidURL(step.label)) {
        stepWarnings.push("label");
      }
      if (isValidURL(step.instructions)) {
        stepWarnings.push("instructions");
      }

      if (stepWarnings.length > 0) {
        warnings[step.id] = stepWarnings;
      }
    });

    setUrlWarnings(warnings);
    setSteps(updatedSteps);
    onStepsChange(updatedSteps);
  };

  // Validation function to check if all textboxes are filled
  const areAllStepsFilled = () => {
    console.log("\n\n\n here \n\n\n", steps);
    return steps.every(
      (step) => step.label.trim() !== "" && step.instructions.trim() !== ""
    );
  };

  const addStep = () => {
    // Check for maximum steps limit
    if (steps.length >= 20) {
      return; // Don't add more steps if limit reached
    }

    // Only add a new step if all existing steps are filled out
    if (areAllStepsFilled()) {
      const newSteps = [
        ...steps,
        {
          id: steps.length > 0 ? Math.max(...steps.map((s) => s.id)) + 1 : 1,
          label: "",
          instructions: "",
          temperature: 50,
        },
      ];
      handleStepsChange(newSteps);
    }
  };

  // Check if button should be disabled
  const isAddButtonDisabled = !areAllStepsFilled();

  // Find which steps are missing data for better feedback
  const getIncompleteStepsInfo = () => {
    const incomplete = steps.filter(
      (step) => step.label.trim() === "" || step.instructions.trim() === ""
    );

    return incomplete.map((step) => ({
      id: step.id,
      missingLabel: step.label.trim() === "",
      missingInstructions: step.instructions.trim() === "",
    }));
  };

  const incompleteSteps = getIncompleteStepsInfo();

  // Add a function to check if any steps contain URLs
  const hasURLs = Object.keys(urlWarnings).length > 0;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">1. Add Steps to Cognitive Process</h2>

      {/* URL Warning Banner */}
      {hasURLs && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">URLs Detected</span>
          </div>
          <div className="mt-2 text-sm text-red-600">
            URLs have been detected in the following locations:
            {Object.entries(urlWarnings).map(([stepId, fields]) => (
              <div key={stepId} className="ml-4">
                • Step {stepId}: {fields.join(", ")}
              </div>
            ))}
            <div className="mt-2">
              Please remove all URLs before proceeding.
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <div
          className={`h-[400px] border rounded-md overflow-hidden ${
            simulationActive ? "opacity-80" : ""
          }`}
        >
          <CognitiveFlow
            steps={steps}
            onStepsChange={handleStepsChange}
            edges={edges}
            onEdgesChange={onEdgesChange}
            disabled={simulationActive}
          />
        </div>

        <div className="mt-4 flex justify-between items-center">
          {isAddButtonDisabled && incompleteSteps.length > 0 && (
            <div className="text-sm text-amber-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>
                Please fill out all required fields in step
                {incompleteSteps.length > 1 ? "s" : ""}{" "}
                {incompleteSteps.map((s) => s.id).join(", ")} before adding a
                new step.
              </span>
            </div>
          )}

          {!isAddButtonDisabled && (
            <div className="text-sm text-green-600 flex-1"></div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {steps.length}/20 steps
            </span>
          </div>
        </div>
      </div>
      {steps.length >= 20 && (
        <div className="text-sm text-amber-600 flex items-center gap-2 justify-end mt-2">
          <AlertCircle className="h-4 w-4" />
          <span>Maximum number of steps (20) reached</span>
        </div>
      )}
    </section>
  );
}
