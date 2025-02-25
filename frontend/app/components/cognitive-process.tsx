"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, GripVertical, ArrowRight } from "lucide-react";
import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface Step {
  id: number;
  label: string;
  instructions: string;
  temperature: number;
}

interface SortableStepProps {
  step: Step;
  updateStep: (id: number, field: keyof Step, value: string | number) => void;
  deleteStep: (id: number) => void;
  isLast: boolean;
}

function SortableStep({
  step,
  updateStep,
  deleteStep,
  isLast,
}: SortableStepProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  };

  return (
    <div className="flex items-center" ref={setNodeRef} style={style}>
      <Card
        className={`w-[200px] p-4 border-primary ${
          isDragging ? "opacity-50" : ""
        }`}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <button
              className="cursor-grab active:cursor-grabbing hover:text-primary"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="w-4 h-4" />
            </button>
            <span className="text-xs text-muted-foreground">
              Step {step.id}
            </span>
          </div>
          <input
            type="text"
            placeholder="[Add Label]"
            className="w-full text-sm border rounded p-2 text-primary"
            value={step.label}
            onChange={(e) => updateStep(step.id, "label", e.target.value)}
          />
          <textarea
            className="w-full h-24 text-sm resize-none border rounded p-2"
            placeholder="[Enter instructions, as if you were asking a human to complete this step.]"
            value={step.instructions}
            onChange={(e) =>
              updateStep(step.id, "instructions", e.target.value)
            }
          />
          <div className="space-y-1">
            <div className="text-sm">Temperature: {step.temperature}</div>
            <input
              type="range"
              min="0"
              max="100"
              value={step.temperature}
              onChange={(e) =>
                updateStep(
                  step.id,
                  "temperature",
                  Number.parseInt(e.target.value)
                )
              }
              className="w-full accent-primary"
            />
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => deleteStep(step.id)}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
        </div>
      </Card>
      {!isLast && (
        <div className="flex items-center justify-center w-12 flex-shrink-0">
          <ArrowRight className="w-6 h-6 text-primary" />
        </div>
      )}
    </div>
  );
}

export default function CognitiveProcess({
  onStepsChange,
  onTemperatureChange,
}: {
  onStepsChange: (steps: Step[]) => void;
  onTemperatureChange: (temperature: number) => void;
}) {
  const [steps, setSteps] = useState<Step[]>([
    { id: 1, label: "", instructions: "", temperature: 50 },
    { id: 2, label: "", instructions: "", temperature: 50 },
  ]);

  const [temperature, setTemperature] = useState<number>(50);

  const handleTemperatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTemperature = Number.parseInt(e.target.value);
    setTemperature(newTemperature);
    onTemperatureChange(newTemperature); // Send new temperature to Home.tsx
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateStepsState = (updatedSteps: Step[]) => {
    setSteps(updatedSteps);
    onStepsChange(updatedSteps); // Send updated steps to parent (Home.tsx)
  };

  const addStep = () => {
    const newSteps = [
      ...steps,
      {
        id: steps.length > 0 ? Math.max(...steps.map((s) => s.id)) + 1 : 1,
        label: "",
        instructions: "",
        temperature: 50,
      },
    ];
    updateStepsState(newSteps);
  };

  const deleteStep = (id: number) => {
    const newSteps = steps.filter((step) => step.id !== id);
    updateStepsState(newSteps);
  };

  const updateStep = (
    id: number,
    field: keyof Step,
    value: string | number
  ) => {
    const newSteps = steps.map((step) =>
      step.id === id ? { ...step, [field]: value } : step
    );
    updateStepsState(newSteps);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const newSteps = arrayMove(
        steps,
        steps.findIndex((item) => item.id === active.id),
        steps.findIndex((item) => item.id === over.id)
      );
      updateStepsState(newSteps);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold">1. Add Steps to Cognitive Process</h2>
      <div className="relative">
        <div className="overflow-x-auto pb-4">
          <div className="flex items-start gap-4 min-w-min">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={steps}
                strategy={horizontalListSortingStrategy}
              >
                <div className="flex items-start">
                  {steps.map((step, index) => (
                    <SortableStep
                      key={step.id}
                      step={step}
                      updateStep={updateStep}
                      deleteStep={deleteStep}
                      isLast={index === steps.length - 1}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <Button
              onClick={addStep}
              size="icon"
              className="h-[200px] w-[50px] flex-shrink-0"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
