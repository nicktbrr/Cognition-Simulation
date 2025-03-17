// "use client";

// import { useState } from "react";
// import { Button } from "@/components/ui/button";
// import { Plus } from "lucide-react";
// import CognitiveFlow from "./cognitive-flow";

// interface Step {
//   id: number;
//   label: string;
//   instructions: string;
//   temperature: number;
// }

// export default function CognitiveProcess2({
//   onStepsChange,
//   onTemperatureChange,
// }: {
//   onStepsChange: (steps: Step[]) => void;
//   onTemperatureChange: (temperature: number) => void;
// }) {
//   const [steps, setSteps] = useState<Step[]>([
//     { id: 1, label: "", instructions: "", temperature: 50 },
//   ]);

//   const handleStepsChange = (updatedSteps: Step[]) => {
//     setSteps(updatedSteps);
//     onStepsChange(updatedSteps);
//   };

//   const addStep = () => {
//     const newSteps = [
//       ...steps,
//       {
//         id: steps.length > 0 ? Math.max(...steps.map((s) => s.id)) + 1 : 1,
//         label: "",
//         instructions: "",
//         temperature: 50,
//       },
//     ];
//     handleStepsChange(newSteps);
//   };

//   return (
//     <section className="space-y-4">
//       <h2 className="text-xl font-bold">1. Add Steps to Cognitive Process</h2>
//       <div className="relative">
//         <div className="h-[400px] border rounded-md overflow-hidden">
//           <CognitiveFlow steps={steps} onStepsChange={handleStepsChange} />
//         </div>
//         <div className="mt-4 flex justify-end">
//           <Button onClick={addStep} className="flex items-center gap-2">
//             <Plus className="h-4 w-4" />
//             Add Step
//           </Button>
//         </div>
//       </div>
//     </section>
//   );
// }

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, AlertCircle } from "lucide-react";
import CognitiveFlow from "./cognitive-flow";

interface Step {
  id: number;
  label: string;
  instructions: string;
  temperature: number;
}

export default function CognitiveProcess2({
  onStepsChange,
  onTemperatureChange,
}: {
  onStepsChange: (steps: Step[]) => void;
  onTemperatureChange: (temperature: number) => void;
}) {
  const [steps, setSteps] = useState<Step[]>([
    { id: 1, label: "", instructions: "", temperature: 50 },
  ]);

  const handleStepsChange = (updatedSteps: Step[]) => {
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

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">1. Add Steps to Cognitive Process</h2>
      <div className="relative">
        <div className="h-[400px] border rounded-md overflow-hidden">
          <CognitiveFlow steps={steps} onStepsChange={handleStepsChange} />
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

          <Button
            onClick={addStep}
            className="flex items-center gap-2"
            disabled={isAddButtonDisabled}
            title={
              isAddButtonDisabled
                ? "Please fill out all textboxes in existing steps first"
                : "Add a new step"
            }
          >
            <Plus className="h-4 w-4" />
            Add Step
          </Button>
        </div>
      </div>
    </section>
  );
}
