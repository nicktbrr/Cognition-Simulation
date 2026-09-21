"use client"

import React from "react"
import { AlertTriangle } from "lucide-react"

interface SampleWarningProps {
  /** Whether this node's share of the sample adds up against the rest of the flow. */
  unbalanced: boolean
  /** Short warning shown on the node the user changed last. */
  warning?: string
  /** Plain-language read-out of where this node's samples come from and go to. */
  message?: string
}

/**
 * How a node's share of the sample adds up.
 *
 * The split itself is set on the arrows between the nodes, so this only
 * appears when something doesn't add up. Shared by both kinds of node - they
 * are split and counted the same way.
 */
export default function SampleWarning({ unbalanced, warning, message }: SampleWarningProps) {
  if (!unbalanced || (!warning && !message)) return null

  return (
    <div className="flex-shrink-0">
      <div className="flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-sm text-red-700">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          {warning && <div>{warning}</div>}
          {message && <div className={warning ? "mt-0.5 text-red-600" : ""}>{message}</div>}
        </div>
      </div>
    </div>
  )
}
