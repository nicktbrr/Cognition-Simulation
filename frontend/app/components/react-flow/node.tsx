"use client"

import React, { memo } from "react"
import { Handle, Position, NodeResizer, type NodeProps } from "@xyflow/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "../ui/slider"
import { Trash2 } from "lucide-react"
import CustomHandle from "./handle"
import Multiselect from "../ui/multiselect"

export interface CustomNodeData {
  title: string
  description: string
  sliderValue: number
  numDescriptionsChars: number
  selectedMeasures: string[]
  measures: Array<{ id: string; title: string; description: string }>
  loadingMeasures: boolean
  width?: number
  height?: number
  onDelete: (id: string) => void
  onTitleChange: (id: string, title: string) => void
  onDescriptionChange: (id: string, description: string) => void
  onSliderChange: (id: string, value: number) => void
  onMeasuresChange: (id: string, selectedMeasures: string[]) => void
  onResize?: (id: string, width: number, height: number) => void
}

const CustomNode = memo(({ id, data, selected, width, height }: NodeProps) => {
  // Get the selected color or default to white
  const selectedColor = (data as any).selectedColor || '#ffffff';
  
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
      <CustomHandle type="target" position={Position.Left} connectionCount={1} />
      
      <div 
        className="rounded-lg p-6 transition-all duration-300 overflow-hidden flex flex-col h-full w-full"
        style={{
          ...gradientStyle,
          boxSizing: 'border-box',
        }}
      >

      <div className="flex flex-col space-y-4 flex-1 min-h-0">
        {/* Title Input */}
        <div className="flex-shrink-0">
          <label className="text-base font-medium text-muted-foreground mb-1.5 block">Title</label>
          <Input
            value={(data as any).title}
            onChange={(e) => (data as any).onTitleChange(id, e.target.value)}
            placeholder="Click to add title..."
            className="text-base"
          />
        </div>

        {/* Description Input - scales with node size */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <label className="text-base font-medium text-muted-foreground mb-1.5 block flex-shrink-0">Description</label>
          <Textarea
            value={(data as any).description}
            maxLength={(data as any).numDescriptionsChars}
            onChange={(e) => (data as any).onDescriptionChange(id, e.target.value)}
            placeholder="Click to add description..."
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

        {/* Measures Selection */}
        <div className="flex-shrink-0">
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
      
      <CustomHandle type="source" position={Position.Right} connectionCount={1} />
    </>
  )
})

CustomNode.displayName = "CustomNode"

export default CustomNode
