"use client";

import React, { useEffect, useMemo, useState } from "react";
import DistributionEditor from "./DistributionEditor";
import { Button } from "./ui/button";
import { continuousBounds, getAttributeByLabel, isContinuous } from "../data/attributeCatalog";
import {
  ensureDistribution,
  formatRange,
  validateContinuous,
  type Distribution,
  type SampleAttributeJson,
} from "../utils/distributions";

interface SampleAttributeCardProps {
  attribute: SampleAttributeJson;
  /** Persist the attribute with its new distribution. */
  onSave: (attribute: SampleAttributeJson) => Promise<void>;
}

/**
 * One attribute of a sample on the Samples page: its values and how the
 * sample is spread over them, editable in place.
 */
export default function SampleAttributeCard({ attribute, onSave }: SampleAttributeCardProps) {
  const catalogAttribute = getAttributeByLabel(attribute.label, attribute.category);
  const bounds = catalogAttribute && isContinuous(catalogAttribute) ? continuousBounds(catalogAttribute) : undefined;
  const values = attribute.values || [];

  const stored = useMemo(() => ensureDistribution(attribute), [attribute]);
  const [draft, setDraft] = useState<Distribution>(stored);
  const [saving, setSaving] = useState(false);
  // A save or a reload elsewhere replaces whatever was being edited.
  useEffect(() => setDraft(stored), [stored]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  const error = draft.type === "continuous" ? validateContinuous(draft, bounds) : null;

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        ...attribute,
        values:
          draft.type === "continuous"
            ? [formatRange(draft.min, draft.max, catalogAttribute?.unit)]
            : values,
        distribution: draft,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg shadow-sm">
      <div className="mb-3 min-w-0">
        <div className="text-sm font-medium text-gray-900 mb-1">{attribute.category}</div>
        <div className="text-base font-semibold text-blue-600 truncate">{attribute.label}</div>
      </div>

      {values.length > 0 ? (
        <div className="max-h-64 overflow-y-auto pr-2">
          <DistributionEditor
            values={values}
            distribution={draft}
            onChange={setDraft}
            bounds={bounds}
            unit={catalogAttribute?.unit}
          />
        </div>
      ) : (
        <div className="text-sm text-gray-900">Selected</div>
      )}

      {dirty && (
        <div className="flex justify-end gap-2 mt-3">
          <Button variant="outline" size="sm" onClick={() => setDraft(stored)} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={save}
            disabled={saving || !!error}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
