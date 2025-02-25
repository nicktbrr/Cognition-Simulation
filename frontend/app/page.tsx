// "use client";
// import { useState } from "react";
// import Header from "./components/header";
// import CollapsibleNav from "./components/collapsible-nav";
// import CognitiveProcess from "./components/cognitive-process";
// import EvaluationCriteria from "./components/evaluation-criteria";
// import ActionButtons from "./components/action-buttons";

// interface Step {
//   id: number;
//   label: string;
//   instructions: string;
//   temperature: number;
// }

// export default function Home() {
//   const [steps, setSteps] = useState<Step[]>([]);
//   const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
//   const [temperature, setTemperature] = useState<number>(50); // Default temperature

//   // Update steps when they change
//   const handleStepsUpdate = (updatedSteps: Step[]) => {
//     setSteps(updatedSteps);
//   };

//   // Update selected evaluation criteria
//   const handleMetricsUpdate = (metrics: string[]) => {
//     setSelectedMetrics(metrics);
//   };

//   // Update temperature when changed
//   const handleTemperatureChange = (newTemperature: number) => {
//     setTemperature(newTemperature);
//   };

//   const handleSubmit = () => {
//     console.log("Submitted Steps Order:", steps);
//     console.log("Selected Metrics:", selectedMetrics);
//     console.log("Temperature:", temperature);

//     alert("Steps submitted! Check console for output.");
//   };

//   return (
//     <div className="max-w-6xl mx-auto p-6 space-y-8">
//       <Header />
//       <CollapsibleNav />
//       <main className="space-y-8">
//         <CognitiveProcess
//           onStepsChange={handleStepsUpdate}
//           onTemperatureChange={handleTemperatureChange}
//         />
//         <EvaluationCriteria onMetricsChange={handleMetricsUpdate} />
//         <ActionButtons
//           onSubmit={handleSubmit}
//           steps={steps}
//           metrics={selectedMetrics}
//           temperature={temperature}
//         />
//       </main>
//     </div>
//   );
// }

"use client";
import { useState } from "react";
import Header from "./components/header";
import CollapsibleNav from "./components/collapsible-nav";
import CognitiveProcess from "./components/cognitive-process";
import EvaluationCriteria from "./components/evaluation-criteria";
import ActionButtons from "./components/action-buttons";

interface Step {
  id: number;
  label: string;
  instructions: string;
  temperature: number;
}

export default function Home() {
  const [steps, setSteps] = useState<Step[]>([]);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [temperature, setTemperature] = useState<number>(50);

  // Update steps when they change
  const handleStepsUpdate = (updatedSteps: Step[]) => {
    setSteps(updatedSteps);
  };

  // Update selected evaluation criteria (metrics)
  const handleMetricsUpdate = (metrics: string[]) => {
    setSelectedMetrics(metrics);
  };

  // Update global temperature when changed
  const handleTemperatureChange = (newTemperature: number) => {
    setTemperature(newTemperature);
  };

  // When the submit button is pressed, log and alert the data
  const handleSubmit = () => {
    console.log("Submitted Steps Order:", steps);
    console.log("Selected Metrics:", selectedMetrics);
    console.log("Temperature:", temperature);
    alert("Steps submitted! Check console for output.");
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <Header />
      <CollapsibleNav />
      <main className="space-y-8">
        <CognitiveProcess
          onStepsChange={handleStepsUpdate}
          onTemperatureChange={handleTemperatureChange}
        />
        <EvaluationCriteria onMetricsChange={handleMetricsUpdate} />
        <ActionButtons
          onSubmit={handleSubmit}
          steps={steps}
          metrics={selectedMetrics}
          temperature={temperature}
        />
      </main>
    </div>
  );
}
