"use client"

import React, { memo } from "react"
import { Position, NodeResizer, type NodeProps } from "@xyflow/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"
import CustomHandle from "./handle"
import Multiselect from "../ui/multiselect"
import SampleWarning from "./sample-warning"
import type { Measure } from "../../types/measure"

export interface MeasureNodeData {
  /** What this node is called in the results. Defaults to the measure's title. */
  title: string
  /** The measure this node puts to the persona, or null until one is picked. */
  measureId: string | null
  /** Percent of the full sample routed through this node. */
  sampleProportion: number
  sampleStatus?: 'ok' | 'over' | 'under'
  sampleMessage?: string
  sampleWarning?: string
  measures: Measure[]
  loadingMeasures: boolean
  readOnly?: boolean
  width?: number
  height?: number
  onDelete: (id: string) => void
  onTitleChange: (id: string, title: string) => void
  onTitleBlur?: () => void
  onMeasureNodeSelect: (id: string, measureId: string | null) => void
  onRequestAddMeasure?: (id: string) => void
  onResize?: (id: string, width: number, height: number) => void
}

/**
 * A scale put to the persona, as a node in the flow.
 *
 * Where a step asks the persona to do something in its own words, a measure
 * node asks it to answer each of the measure's items on the anchor points -
 * before, during or after the process steps. What it answers is carried into
 * the steps that follow.
 */
const MeasureNode = memo(({ id, data, selected }: NodeProps) => {
  const selectedColor = (data as any).selectedColor || '#ffffff';
  const sampleStatus = (data as any).sampleStatus || 'ok';
  const sampleUnbalanced = sampleStatus !== 'ok';
  const readOnly = (data as any).readOnly === true;

  const measures: Measure[] = (data as any).measures || [];
  const measureId: string | null = (data as any).measureId ?? null;
  const measure = measures.find((candidate) => candidate.id === measureId) || null;

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

  // A node whose share of the sample doesn't add up is called out in red.
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
        minHeight={360}
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
      {/* Unlimited connections, exactly like a step - a scale can sit anywhere */}
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
          {/* What kind of node this is */}
          <div className="flex-shrink-0">
            <span className="inline-block rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              Measure
            </span>
          </div>

          {/* Name - what this node is called in the results */}
          <div className="flex-shrink-0">
            <label className="text-base font-medium text-muted-foreground mb-1.5 block">Name</label>
            <Input
              value={(data as any).title || ''}
              onChange={(e) => (data as any).onTitleChange(id, e.target.value)}
              onBlur={() => (data as any).onTitleBlur?.()}
              placeholder={measure ? measure.title : "Click to add a name..."}
              readOnly={readOnly}
              className={`text-base ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`}
            />
          </div>

          {/* Which measure this node administers */}
          <div className="flex-shrink-0 overflow-visible">
            <label className="text-base font-medium text-muted-foreground mb-1.5 block">Measure</label>
            <Multiselect
              options={measures}
              selectedValues={measureId ? [measureId] : []}
              onSelectionChange={(ids) =>
                (data as any).onMeasureNodeSelect(id, ids.length > 0 ? ids[ids.length - 1] : null)
              }
              placeholder="Select a measure..."
              loading={(data as any).loadingMeasures || false}
              disabled={readOnly}
              single
              className="w-full"
            />
          </div>

          {/* What the persona will be asked */}
          <div className="flex-1 min-h-0 overflow-auto rounded-md border border-gray-200 bg-gray-50/70 p-3 text-sm">
            {!measure ? (
              <p className="text-muted-foreground">
                Select an existing measure, or add a new one below.
              </p>
            ) : (
              <div className="space-y-2">
                {measure.citation && (
                  <div>
                    <span className="font-medium text-muted-foreground">Cite </span>
                    <span className="italic">{measure.citation}</span>
                  </div>
                )}
                {measure.description && (
                  <div>
                    <span className="font-medium text-muted-foreground">Instructions </span>
                    <span>{measure.description}</span>
                  </div>
                )}
                <div>
                  <span className="font-medium text-muted-foreground">Range </span>
                  <span>{measure.range}</span>
                </div>
                {measure.desiredValues?.length > 0 && (
                  <div>
                    <div className="font-medium text-muted-foreground">Anchors</div>
                    <div className="mt-1 space-y-1">
                      {measure.desiredValues.map((anchor, index) => (
                        <div key={index} className="flex items-center">
                          <span className="mr-2 min-w-[22px] rounded-full bg-blue-400 px-1.5 py-0.5 text-center text-xs text-white">
                            {anchor.value}
                          </span>
                          <span>{anchor.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <div className="font-medium text-muted-foreground">
                    Items{measure.items?.length ? ` (${measure.items.length})` : ''}
                  </div>
                  {measure.items?.length ? (
                    <ol className="mt-1 list-decimal list-inside space-y-0.5">
                      {measure.items.map((item) => (
                        <li key={item.id}>{item.text}</li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-1 text-red-600">
                      This measure has no items, so there is nothing for a persona to answer.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {!readOnly && (
            <div className="flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => (data as any).onRequestAddMeasure?.(id)}
                className="text-sm font-medium flex items-center gap-1 px-0 text-blue-600 hover:text-blue-700 hover:bg-transparent"
              >
                <Plus className="w-4 h-4" />
                Add New Measure
              </Button>
            </div>
          )}

          <SampleWarning
            unbalanced={sampleUnbalanced}
            warning={(data as any).sampleWarning}
            message={(data as any).sampleMessage}
          />

          {/* Delete Button */}
          <div className="flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => (data as any).onDelete(id)}
              disabled={readOnly}
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

MeasureNode.displayName = "MeasureNode"

export default MeasureNode
