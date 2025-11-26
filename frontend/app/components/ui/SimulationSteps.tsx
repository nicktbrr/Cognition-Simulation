import React from "react";

interface SimulationStep {
  label: string;
  instructions: string;
  temperature: number;
}

interface SimulationStepsProps {
  steps: SimulationStep[];
}

export default function SimulationSteps({ steps }: SimulationStepsProps) {
  return (
    <div className="flex-1">
      <h3 className="text-blue-400 font-medium mb-3">Simulation Steps:</h3>
      <div className="space-y-2">
        {steps.map((step, stepIndex) => (
          <div key={stepIndex} className="flex items-start gap-3">
            <span className="bg-blue-400 text-white text-xs px-2 py-1 rounded-full min-w-[20px] text-center flex-shrink-0">
              {stepIndex + 1}
            </span>
            <span className="text-gray-900 text-sm">
              <span className="font-medium">{step.label}</span>
              {step.instructions && (
                <span>: {step.instructions}</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}