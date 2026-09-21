"use client"

import React, { memo, useEffect, useRef, useState } from "react"
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react"

export interface PersonaSplitEdgeData {
  /** Whole samples travelling this arrow. */
  personas: number
  /** Samples standing on the step this arrow leaves, for the read-out. */
  available: number
  /**
   * Whether this arrow's share can be typed in.
   *
   * A step several branches rejoin has no single arrow to change - what
   * reaches it is shared out by the solver - so those arrows are read-only.
   */
  editable: boolean
  onPersonaCountChange?: (edgeId: string, personas: number) => void
}

/**
 * An arrow that carries - and lets you set - the samples going down it.
 *
 * The count is the split itself: typing a number here gives the step on the
 * other end that many samples and shares the rest out among the branches
 * beside it.
 */
const PersonaSplitEdge = memo(
  ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    style,
    data,
  }: EdgeProps) => {
    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    })

    const personas = (data as any)?.personas as number | undefined
    const available = (data as any)?.available as number | undefined
    const editable = (data as any)?.editable === true

    const inputRef = useRef<HTMLInputElement | null>(null)

    // While the box is being typed in it holds exactly what was typed - an
    // empty box stays empty rather than snapping back to 0.
    const [draft, setDraft] = useState<string | null>(null)
    useEffect(() => {
      // A change from elsewhere (a re-split upstream) wins over a stale draft.
      setDraft(null)
    }, [personas])

    return (
      <>
        <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
        {personas !== undefined && (
          <EdgeLabelRenderer>
            <div
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                pointerEvents: 'all',
              }}
              // The whole box hands the click to the number, so the target is
              // the label rather than the few pixels the digits take up.
              onMouseDown={(event) => {
                if (!editable) return
                event.stopPropagation()
                inputRef.current?.focus()
                inputRef.current?.select()
              }}
              className={`nodrag nopan flex items-center gap-1.5 rounded-lg border-2 border-blue-500 bg-white px-3 py-2 shadow-md ${
                editable ? 'cursor-text hover:bg-blue-50' : ''
              }`}
              title={
                editable
                  ? `Samples sent down this branch${
                      available !== undefined ? ` (of ${available} reaching this step)` : ''
                    }`
                  : 'Samples travelling this arrow. Steps that branches rejoin are split automatically.'
              }
            >
              {editable ? (
                <input
                  ref={inputRef}
                  type="number"
                  min={0}
                  max={available}
                  step={1}
                  value={draft ?? personas}
                  onChange={(event) => {
                    setDraft(event.target.value)
                    const parsed = parseInt(event.target.value, 10)
                    // An empty (or half-typed) box isn't a count yet, so the
                    // flow keeps the last real value until one is typed.
                    if (!Number.isNaN(parsed)) {
                      ;(data as any).onPersonaCountChange?.(id, parsed)
                    }
                  }}
                  onFocus={(event) => event.target.select()}
                  onBlur={() => setDraft(null)}
                  className="w-12 bg-transparent text-center text-lg font-bold leading-none text-blue-700 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              ) : (
                <span className="px-1 text-lg font-bold leading-none text-blue-700">{personas}</span>
              )}
              <span className="text-sm font-medium text-blue-700">
                {personas === 1 ? 'sample' : 'samples'}
              </span>
            </div>
          </EdgeLabelRenderer>
        )}
      </>
    )
  }
)

PersonaSplitEdge.displayName = "PersonaSplitEdge"

export default PersonaSplitEdge
