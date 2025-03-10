"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import CognitiveFlow from "./cognitive-flow"

interface Step {
  id: number
  label: string
  instructions: string
  temperature: number
}

export default function CognitiveProcess2({
  onStepsChange,
  onTemperatureChange,
}: {
  onStepsChange: (steps: Step[]) => void
  onTemperatureChange: (temperature: number) => void
}) {
  const [steps, setSteps] = useState<Step[]>([
    { id: 1, label: "", instructions: "", temperature: 50 },
    { id: 2, label: "", instructions: "", temperature: 50 },
  ])

  const handleStepsChange = (updatedSteps: Step[]) => {
    setSteps(updatedSteps)
    onStepsChange(updatedSteps)
  }

  const addStep = () => {
    const newSteps = [
      ...steps,
      {
        id: steps.length > 0 ? Math.max(...steps.map((s) => s.id)) + 1 : 1,
        label: "",
        instructions: "",
        temperature: 50,
      },
    ]
    handleStepsChange(newSteps)
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">1. Add Steps to Cognitive Process</h2>
      <div className="relative">
        <div className="h-[400px] border rounded-md overflow-hidden">
          <CognitiveFlow steps={steps} onStepsChange={handleStepsChange} />
        </div>
        <div className="mt-4 flex justify-end">
          <Button onClick={addStep} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Step
          </Button>
        </div>
      </div>
    </section>
  )
}