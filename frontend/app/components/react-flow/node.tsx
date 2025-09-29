"use client"

import React, { memo } from "react"
import { Handle, Position, type NodeProps } from "@xyflow/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "../ui/slider"
import { Trash2 } from "lucide-react"
import CustomHandle from "./handle"

export interface CustomNodeData {
  title: string
  description: string
  sliderValue: number
  numDescriptionsChars: number
  onDelete: (id: string) => void
  onTitleChange: (id: string, title: string) => void
  onDescriptionChange: (id: string, description: string) => void
  onSliderChange: (id: string, value: number) => void
}

const CustomNode = memo(({ id, data }: NodeProps) => {
  // Console log the selected color for this specific node
  if ((data as any).selectedColor) {
    console.log(`Node ${id} has selected color:`, (data as any).selectedColor);
  }
  
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 min-w-[250px] shadow-sm">
      <CustomHandle type="source" position={Position.Right} connectionCount={1} />

      <div className="space-y-3">
        {/* Title Input */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-1 block">Title</label>
          <Input
            value={(data as any).title}
            onChange={(e) => (data as any).onTitleChange(id, e.target.value)}
            placeholder="Click to add title..."
            className="text-sm"
          />
        </div>

        {/* Description Input */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-.5 block">Description</label>
          <Textarea
            value={(data as any).description}
            maxLength={(data as any).numDescriptionsChars}
            onChange={(e) => (data as any).onDescriptionChange(id, e.target.value)}
            placeholder="Click to add description..."
            className="text-sm min-h-[80px] resize-none"
            rows={3}
          />
          <div className="text-xs text-muted-foreground mt-.5 text-right">
            {(data as any).description.length}/{(data as any).numDescriptionsChars}
          </div>
        </div>

        {/* Slider */}
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-.5 block">Temperature: {(data as any).sliderValue}</label>
          <Slider
            value={[(data as any).sliderValue]}
            onValueChange={(value) => (data as any).onSliderChange(id, value[0])}
            max={100}
            min={1}
            step={1}
            className="w-full"
          />
        </div>

        {/* Delete Button */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => (data as any).onDelete(id)} 
          className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Node
        </Button>
      </div>

      <CustomHandle type="target" position={Position.Left} connectionCount={1} />
    </div>
  )
})

CustomNode.displayName = "CustomNode"

export default CustomNode
