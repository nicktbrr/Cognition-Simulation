"use client";
import { useState } from "react";
import Header from "./components/header";
import CollapsibleNav from "./components/collapsible-nav";
import CognitiveProcess from "./components/cognitive-process";
import EvaluationCriteria from "./components/evaluation-criteria";
import ActionButtons from "./components/action-buttons";
import CognitiveProcess2 from "./components/cognitive-process2";
import SimulationStatusIndicator from "./components/indicator";

interface Step {
  id: number;
  label: string;
  instructions: string;
  temperature: number;
}

// Define an Edge interface to track connections
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

export default function Home() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<any[]>([]);
  const [temperature, setTemperature] = useState<number>(50);
  // Add state for tracking edges
  const [edges, setEdges] = useState<Edge[]>([]);

  const [simulationActive, setSimulationActive] = useState<boolean>(false);
  const [hasUrls, setHasUrls] = useState(false);

  // Update steps when they change
  const handleStepsUpdate = (updatedSteps: Step[]) => {
    setSteps(updatedSteps);
  };

  // Update selected evaluation criteria (metrics)
  const handleMetricsUpdate = (metrics: any[]) => {
    setSelectedMetrics(metrics);
  };

  // Update global temperature when changed
  const handleTemperatureChange = (newTemperature: number) => {
    setTemperature(newTemperature);
  };

  // Add handler for edge updates
  const handleEdgesUpdate = (updatedEdges: Edge[]) => {
    setEdges(updatedEdges);
  };

  // Add handler for URL detection
  const handleUrlDetection = (detected: boolean) => {
    setHasUrls(detected);
  };

  // When the submit button is pressed, log and alert the data
  const handleSubmit = () => {
    console.log("Submitted Steps Order:", steps);
    console.log("Selected Metrics:", selectedMetrics);
    console.log("Temperature:", temperature);
    console.log("Node Connections:", edges);

    // Create a map of step connections for easier understanding
    const connections = edges.map((edge) => ({
      from:
        steps.find((step) => step.id.toString() === edge.source)?.label ||
        edge.source,
      to:
        steps.find((step) => step.id.toString() === edge.target)?.label ||
        edge.target,
    }));
    console.log("Step Flow:", connections);

    alert("Steps submitted! Check console for output.");
  };

  return (
    <>
      <SimulationStatusIndicator isActive={simulationActive} />
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <Header />
        <CollapsibleNav />
        <main className="space-y-8">
          <CognitiveProcess2
            onStepsChange={handleStepsUpdate}
            onTemperatureChange={handleTemperatureChange}
            edges={edges}
            onEdgesChange={handleEdgesUpdate}
            simulationActive={simulationActive}
          />
          <EvaluationCriteria
            onMetricsChange={handleMetricsUpdate}
            simulationActive={simulationActive}
            onUrlDetected={handleUrlDetection}
          />
          <ActionButtons
            onSubmit={handleSubmit}
            steps={steps}
            metrics={selectedMetrics}
            edges={edges}
            setSimulationActive={setSimulationActive}
            hasUrls={hasUrls}
          />
        </main>
      </div>
    </>
  );
}
