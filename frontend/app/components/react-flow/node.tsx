"use client"

import React, { memo, useEffect, useState } from "react"
import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "../ui/slider"
import { AlertTriangle, Trash2 } from "lucide-react"
import CustomHandle from "./handle"
import Multiselect from "../ui/multiselect"

export interface CustomNodeData {
  title: string
  description: string
  sliderValue: number
  /** Percent of the full persona sample routed through this step. */
  sampleProportion: number
  /** Whether this step's share of the sample adds up against the rest of the flow. */
  sampleStatus?: 'ok' | 'over' | 'under'
  /** Plain-language read-out of where this step's sample comes from and goes to. */
  sampleMessage?: string
  /** Short warning shown on the step the user last changed, when the sample stops adding up. */
  sampleWarning?: string
  numDescriptionsChars: number
  selectedMeasures: string[]
  measures: Array<{ id: string; title: string; description: string }>
  loadingMeasures: boolean
  width?: number
  height?: number
  onDelete: (id: string) => void
  onTitleChange: (id: string, title: string) => void
  onTitleBlur?: () => void
  onDescriptionChange: (id: string, description: string) => void
  onDescriptionBlur?: () => void
  onSliderChange: (id: string, value: number) => void
  onSampleProportionChange: (id: string, value: number) => void
  onMeasuresChange: (id: string, selectedMeasures: string[]) => void
  onResize?: (id: string, width: number, height: number) => void
}

const CustomNode = memo(({ id, data, selected, width, height }: NodeProps) => {
  // Get the selected color or default to white
  const selectedColor = (data as any).selectedColor || '#ffffff';
  const sampleStatus = (data as any).sampleStatus || 'ok';
  const sampleUnbalanced = sampleStatus !== 'ok';
  const sampleProportion = (data as any).sampleProportion ?? 100;

  // While the field is being typed in it holds exactly what was typed - an
  // empty box stays empty rather than snapping back to 0.
  const [proportionDraft, setProportionDraft] = useState<string | null>(null);
  useEffect(() => {
    // A change from elsewhere (a rebalance upstream) wins over a stale draft.
    setProportionDraft(null);
  }, [sampleProportion]);

  // Create a gradient background using the selected color
  const gradientStyle = selectedColor !== '#ffffff'
    ? {
        background: `linear-gradient(135deg, ${selectedColor}20, ${selectedColor}40, ${selectedColor}60)`,
        border: `2px solid ${selectedColor}`,
        boxShadow: `0 4px 12px ${selectedColor}30`
      }
    : {
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
      };

  // A step whose share of the sample doesn't add up is called out in red.
  const balanceStyle = sampleUnbalanced
    ? {
        border: '2px solid #dc2626',
        boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.2)',
      }
    : {};

  return (
    <>
      <NodeResizer
        color={selectedColor !== '#ffffff' ? selectedColor : '#3b82f6'}
        isVisible={selected}
        minWidth={300}
        minHeight={400}
        handleStyle={{
          width: '28px',
          height: '28px',
          borderRadius: '6px',
          border: '3px solid white',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
        }}
        lineStyle={{
          borderWidth: '3px',
        }}
        onResizeEnd={(event, params) => {
          if ((data as any).onResize) {
            (data as any).onResize(id, params.width, params.height);
          }
        }}
      />
      {/* Unlimited connections: many in lets branches merge, many out lets a step branch */}
      <CustomHandle type="target" position={Position.Left} />
      
      <div 
        className="rounded-lg p-6 transition-all duration-300 overflow-visible flex flex-col h-full w-full"
        style={{
          ...gradientStyle,
          ...balanceStyle,
          boxSizing: 'border-box',
        }}
      >

      <div className="flex flex-col space-y-4 flex-1 min-h-0">
        {/* Name Input */}
        <div className="flex-shrink-0">
          <label className="text-base font-medium text-muted-foreground mb-1.5 block">Name</label>
          <Input
            value={(data as any).title}
            onChange={(e) => (data as any).onTitleChange(id, e.target.value)}
            onBlur={() => (data as any).onTitleBlur?.()}
            placeholder="Click to add step name..."
            className="text-base"
          />
        </div>

        {/* Instructions Input - scales with node size */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <label className="text-base font-medium text-muted-foreground mb-1.5 block flex-shrink-0">Instructions</label>
          <Textarea
            value={(data as any).description}
            maxLength={(data as any).numDescriptionsChars}
            onChange={(e) => (data as any).onDescriptionChange(id, e.target.value)}
            onBlur={() => (data as any).onDescriptionBlur?.()}
            placeholder="Click to add step instructions..."
            className="text-base w-full resize-none flex-1 min-h-[150px]"
            style={{
              overflow: 'auto',
            }}
          />
          <div className="text-sm text-muted-foreground mt-1 text-right flex-shrink-0">
            {(data as any).description.length}/{(data as any).numDescriptionsChars}
          </div>
        </div>

        {/* Slider */}
        <div className="flex-shrink-0">
          <label className="text-base font-medium text-muted-foreground mb-1.5 block">Temperature: {(data as any).sliderValue}</label>
          <Slider
            value={[(data as any).sliderValue]}
            onValueChange={(value) => (data as any).onSliderChange(id, value[0])}
            max={100}
            min={1}
            step={1}
            className="w-full"
          />
        </div>

        {/* Sample proportion - what share of the personas travel through this step */}
        <div className="flex-shrink-0">
          <label className={`text-base font-medium mb-1.5 block ${sampleUnbalanced ? "text-red-600" : "text-muted-foreground"}`}>
            Sample Proportion
          </label>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={100}
              step={1}
              value={proportionDraft ?? sampleProportion}
              onChange={(e) => {
                setProportionDraft(e.target.value)
                const parsed = parseFloat(e.target.value)
                // An empty (or half-typed) box isn't a proportion yet, so the
                // flow keeps the last real value until one is typed.
                if (!Number.isNaN(parsed)) {
                  ;(data as any).onSampleProportionChange?.(id, parsed)
                }
              }}
              onBlur={() => setProportionDraft(null)}
              className={`text-base ${sampleUnbalanced ? "border-red-500 focus-visible:ring-red-500" : ""}`}
            />
            <span className="text-base text-muted-foreground">%</span>
          </div>
          {(data as any).sampleMessage && (
            <div className="text-sm mt-1 text-muted-foreground">
              {(data as any).sampleMessage}
            </div>
          )}
          {sampleUnbalanced && (data as any).sampleWarning && (
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{(data as any).sampleWarning}</span>
            </div>
          )}
        </div>

        {/* Measures Selection */}
        <div className="flex-shrink-0 overflow-visible">
          <label className="text-base font-medium text-muted-foreground mb-1.5 block">Measures</label>
          <Multiselect
            options={(data as any).measures || []}
            selectedValues={(data as any).selectedMeasures || []}
            onSelectionChange={(selectedMeasures) => (data as any).onMeasuresChange(id, selectedMeasures)}
            placeholder="Select measures..."
            loading={(data as any).loadingMeasures || false}
            className="w-full"
          />
        </div>

        {/* Delete Button */}
        <div className="flex-shrink-0">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => (data as any).onDelete(id)} 
            className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
          >
            <Trash2 className="w-5 h-5 mr-2" />
            Delete Node
          </Button>
        </div>
      </div>
      </div>
      
      <CustomHandle type="source" position={Position.Right} />
    </>
  )
})

CustomNode.displayName = "CustomNode"

export default CustomNode
