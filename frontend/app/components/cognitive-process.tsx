"use client";

import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import CognitiveFlow from "./cognitive-flow";
import { isValidURL } from "@/app/utils/urlParser";
import Papa from "papaparse";

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
  onTitleChange,
}: {
  onStepsChange: (steps: Step[]) => void;
  onTemperatureChange: (temperature: number) => void;
  edges?: Edge[];
  onEdgesChange?: (edges: Edge[]) => void;
  simulationActive?: boolean;
  onTitleChange?: (title: string) => void;
}) {
  const [steps, setSteps] = useState<Step[]>([]);
  const [title, setTitle] = useState<string>("");
  const [urlWarnings, setUrlWarnings] = useState<{ [key: number]: string[] }>(
    {}
  );

  // Add effect to notify parent of title changes
  useEffect(() => {
    if (onTitleChange) {
      onTitleChange(title);
    }
  }, [title, onTitleChange]);

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

      {/* Title Input */}
      <div className="mb-4">
        <label htmlFor="title" className="block text-lg font-medium mb-2">
          Title
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter a title for your cognitive process"
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          disabled={simulationActive}
        />
      </div>

      {/* CSV Upload Button */}
      <div className="mb-4">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              // Set the title from the file name (remove .csv extension)
              const fileName = file.name.replace('.csv', '');
              setTitle(fileName);
              if (onTitleChange) {
                onTitleChange(fileName);
              }

              Papa.parse(file, {
                header: true,
                complete: (results) => {
                  // First clear all existing steps and edges
                  handleStepsChange([]);
                  if (onEdgesChange) {
                    onEdgesChange([]);
                  }

                  const newSteps = results.data
                    .filter((row: any) => row.label && row.description)
                    .slice(0, 20)
                    .map((row: any, index: number) => ({
                      id: index + 1, // Start from 1 for new steps
                      label: row.label,
                      instructions: row.description,
                      temperature: 50,
                    }));

                  if (newSteps.length > 0) {
                    // Add new steps
                    handleStepsChange(newSteps);

                    // Create sequential connections between nodes
                    const newEdges = newSteps.slice(0, -1).map((step, index) => ({
                      id: `e${step.id}-${newSteps[index + 1].id}`,
                      source: step.id.toString(),
                      target: newSteps[index + 1].id.toString(),
                      animated: true,
                      style: { stroke: "hsl(var(--primary))", strokeWidth: 2 },
                      markerEnd: {
                        type: "arrowclosed",
                        width: 20,
                        height: 20,
                        color: "hsl(var(--primary))",
                      },
                    }));

                    // Update edges if onEdgesChange is provided
                    if (onEdgesChange) {
                      onEdgesChange(newEdges);
                    }
                  }
                },
                error: (error) => {
                  console.error('Error parsing CSV:', error);
                }
              });
            }
          }}
          className="hidden"
          id="csv-upload"
        />
        <label
          htmlFor="csv-upload"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary cursor-pointer"
        >
          Upload CSV
        </label>
        <span className="ml-2 text-sm text-muted-foreground">
          Upload a CSV file with 'label' and 'description' columns (max 20 rows)
        </span>

      </div>

      <div className="mb-4">
        <a
          href="/template.csv"
          download
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary cursor-pointer"
        >
          Download template
        </a>
      </div>

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
          className={`h-[600px] border rounded-md overflow-hidden ${
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
          <div></div>
          {/* {isAddButtonDisabled && incompleteSteps.length > 0 && (
            <div className="text-sm text-amber-600 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>
                Please fill out all required fields in step
                {incompleteSteps.length > 1 ? "s" : ""}{" "}
                {incompleteSteps.map((s) => s.id).join(", ")} before adding a
                new step.
              </span>
            </div>
          )} */}

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
