import React from "react";

export interface SimulationStepMeasure {
  id: string;
  title: string;
  description: string;
  range: string;
}

interface SimulationStep {
  label: string;
  instructions: string;
  temperature: number;
  measures?: SimulationStepMeasure[];
}

interface SimulationStepsProps {
  steps: SimulationStep[];
}

export default function SimulationSteps({ steps }: SimulationStepsProps) {
  // Collect all unique measures from steps (order by first appearance)
  const measuresUsed: SimulationStepMeasure[] = [];
  const seenIds = new Set<string>();
  for (const step of steps) {
    if (Array.isArray(step.measures)) {
      for (const m of step.measures) {
        if (m?.id && !seenIds.has(m.id)) {
          seenIds.add(m.id);
          measuresUsed.push({
            id: m.id,
            title: m.title ?? "",
            description: m.description ?? "",
            range: m.range ?? "",
          });
        }
      }
    }
  }

  return (
    <div className="flex-1 flex flex-col gap-6">
      <div>
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

      {measuresUsed.length > 0 && (
        <div>
          <h3 className="text-blue-400 font-medium mb-3">Measures Used:</h3>
          <div className="space-y-2">
            {measuresUsed.map((measure, index) => (
              <div key={measure.id} className="text-gray-900 text-sm">
                <span className="font-medium">({index + 1}) {measure.title}</span>
                {measure.range && (
                  <span className="text-gray-600"> ({measure.range})</span>
                )}
                {measure.description && (
                  <span>: {measure.description}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}