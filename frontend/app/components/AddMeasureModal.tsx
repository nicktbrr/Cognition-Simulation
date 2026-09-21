"use client";

import React, { useState, useEffect } from "react";
import Modal from "./ui/Modal";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip";
import { Plus, X, HelpCircle } from "lucide-react";
import type { Measure, MeasureDraft } from "../types/measure";
import { deriveRange, newItemId } from "../utils/measures";

interface DesiredValueDraft {
  value: string;
  label: string;
}

interface ItemDraft {
  id: string;
  text: string;
}

interface AddMeasureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (measure: MeasureDraft) => void;
  editingMeasure?: Measure | null;
  onUpdate?: (id: string, measure: MeasureDraft) => void;
  checkNameExists?: (title: string, excludeId?: string) => boolean;
  readOnly?: boolean;
  onCopy?: () => void;
}

const emptyForm = { title: "", description: "", citation: "" };

export default function AddMeasureModal({ isOpen, onClose, onAdd, editingMeasure, onUpdate, checkNameExists, readOnly = false, onCopy }: AddMeasureModalProps) {
  const [formData, setFormData] = useState(emptyForm);
  const [desiredValues, setDesiredValues] = useState<DesiredValueDraft[]>([]);
  const [items, setItems] = useState<ItemDraft[]>([]);
  const [scaleOnly, setScaleOnly] = useState(false);
  const [titleError, setTitleError] = useState<string>('');
  const [anchorError, setAnchorError] = useState<string>('');
  const [itemError, setItemError] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedConfirm, setShowUnsavedConfirm] = useState(false);

  const touch = () => { if (!readOnly) setHasUnsavedChanges(true); };

  // Populate form when editing measure changes
  useEffect(() => {
    if (isOpen) {
      setHasUnsavedChanges(false);
      setShowUnsavedConfirm(false);
    }
    if (editingMeasure) {
      setFormData({
        title: editingMeasure.title,
        description: editingMeasure.description,
        citation: editingMeasure.citation || ""
      });
      setDesiredValues(
        editingMeasure.desiredValues.map(dv => ({
          value: dv.value.toString(),
          label: dv.label
        }))
      );
      setItems((editingMeasure.items || []).map(item => ({ id: item.id, text: item.text })));
      setScaleOnly(editingMeasure.scaleOnly === true);
    } else {
      // Reset form when not editing - every field, or the last measure's
      // answers leak into a fresh one.
      setFormData(emptyForm);
      setDesiredValues([]);
      setItems([]);
      setScaleOnly(false);
    }
    setTitleError(''); // Reset error when modal opens/changes
    setAnchorError('');
    setItemError('');
  }, [editingMeasure, isOpen]);

  // Handle title change with validation
  const handleTitleChange = (title: string) => {
    setFormData(prev => ({ ...prev, title }));
    touch();

    // Check for duplicate title if the function is provided
    if (checkNameExists && title.trim()) {
      const excludeId = editingMeasure?.id;
      if (checkNameExists(title, excludeId)) {
        setTitleError(`A measure with the title "${title.trim()}" already exists.`);
      } else {
        setTitleError('');
      }
    } else {
      setTitleError('');
    }
  };

  // The anchor points are the scale, so its range is simply their ends.
  const filledAnchors = desiredValues
    .filter(dv => dv.value.trim() && dv.label.trim())
    .map(dv => ({ value: parseFloat(dv.value), label: dv.label }))
    .filter(dv => Number.isFinite(dv.value));
  const derived = filledAnchors.length >= 2 ? deriveRange(filledAnchors) : null;

  const addDesiredValue = () => {
    setDesiredValues([...desiredValues, { value: "", label: "" }]);
    touch();
  };

  const removeDesiredValue = (index: number) => {
    setDesiredValues(desiredValues.filter((_, i) => i !== index));
    touch();
  };

  const updateDesiredValue = (index: number, field: 'value' | 'label', value: string) => {
    setDesiredValues(desiredValues.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
    touch();
  };

  const addItem = () => {
    setItems([...items, { id: newItemId(), text: "" }]);
    touch();
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
    touch();
  };

  const updateItem = (index: number, text: string) => {
    setItems(items.map((item, i) => (i === index ? { ...item, text } : item)));
    touch();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAnchorError('');
    setItemError('');

    // Basic validation
    if (!formData.title.trim() || !formData.description.trim()) {
      return;
    }

    // Two anchor points is the least that makes a scale - they are its ends.
    if (filledAnchors.length < 2) {
      setAnchorError('Add at least two anchor points - they set the range of the measure.');
      return;
    }

    const processedItems = items
      .filter(item => item.text.trim())
      .map(item => ({ id: item.id, text: item.text.trim() }));

    // Two items with the same wording would share a results column.
    const seen = new Set<string>();
    const duplicate = processedItems.find(item => {
      const key = item.text.toLowerCase();
      if (seen.has(key)) return true;
      seen.add(key);
      return false;
    });
    if (duplicate) {
      setItemError(`Two items have the same wording ("${duplicate.text}"). Each item needs its own.`);
      return;
    }

    if (scaleOnly && processedItems.length === 0) {
      setItemError('A scale needs at least one item - that is what the persona answers.');
      return;
    }

    const measureData: MeasureDraft = {
      title: formData.title,
      description: formData.description,
      range: deriveRange(filledAnchors).range,
      desiredValues: filledAnchors,
      citation: formData.citation.trim(),
      items: processedItems,
      scaleOnly
    };

    if (editingMeasure && onUpdate) {
      onUpdate(editingMeasure.id, measureData);
    } else {
      onAdd(measureData);
    }
    handleClose();
  };

  const handleClose = () => {
    setFormData(emptyForm);
    setDesiredValues([]);
    setItems([]);
    setScaleOnly(false);
    setTitleError('');
    setAnchorError('');
    setItemError('');
    setShowUnsavedConfirm(false);
    onClose();
  };

  const attemptClose = () => {
    if (readOnly) {
      handleClose();
      return;
    }
    if (hasUnsavedChanges) {
      setShowUnsavedConfirm(true);
    } else {
      handleClose();
    }
  };

  const modalTitle = readOnly ? "View Measure" : (editingMeasure ? "Edit Measure" : "Add New Measure");
  const inputClass = `w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-opacity-20 focus-visible:ring-offset-0 ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''}`;

  return (
    <>
    <Modal
      isOpen={isOpen}
      onClose={attemptClose}
      title={modalTitle}
      banner={readOnly && (
        <div className="w-full bg-red-400/85 text-white px-2 py-1 text-center text-xs font-medium rounded-t-lg flex-shrink-0">
          This measure has already been used in a simulation and cannot be modified. You can copy the measure from the measures page and then edit the copy.
        </div>
      )}
      headerAction={readOnly && onCopy && (
        <Button onClick={onCopy} className="bg-gray-900 hover:bg-gray-700 text-white text-sm px-4 py-2">Make a Copy</Button>
      )}
      footer={
        readOnly ? (
          <Button onClick={handleClose} variant="outline" className="px-6 py-2">Close</Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={attemptClose} className="px-6 py-2">Cancel</Button>
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
              disabled={!!titleError}
              onClick={(e) => { e.preventDefault(); handleSubmit(e); }}
            >
              {editingMeasure ? "Update Measure" : "Add Measure"}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Title
            </label>
            <Input
              placeholder="e.g., Customer Satisfaction"
              value={formData.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              required
              maxLength={80}
              readOnly={readOnly}
              className={`w-full border-2 rounded-lg px-4 py-3 focus:ring-2 focus:ring-opacity-20 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opacity-20 focus-visible:ring-offset-0 ${readOnly ? 'bg-gray-100 cursor-not-allowed' : ''} ${
                titleError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500 focus-visible:ring-red-500'
                  : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500 focus-visible:ring-blue-500'
              }`}
            />
            {titleError && (
              <p className="mt-1 text-sm text-red-600">{titleError}</p>
            )}
          </div>

          {/* Citation - where the measure comes from */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Citation <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <Input
              placeholder="e.g., Amabile (1982), Consensual Assessment Technique"
              value={formData.citation}
              onChange={(e) => { setFormData({ ...formData, citation: e.target.value }); touch(); }}
              readOnly={readOnly}
              className={inputClass}
            />
          </div>

          {/* Instructions */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Instructions
            </label>
            <Textarea
              placeholder="How this measure should be applied (max 400 characters)..."
              value={formData.description}
              onChange={(e) => { setFormData({...formData, description: e.target.value}); touch(); }}
              maxLength={400}
              rows={4}
              required
              readOnly={readOnly}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Anchor Points */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-gray-900">
                  Anchor Points
                  {derived && (
                    <span className="text-gray-500 font-normal ml-1">
                      (range {derived.min} – {derived.max})
                    </span>
                  )}
                </label>
                {!readOnly && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">The answers on the scale, each with the value it scores. The lowest and highest set the measure&apos;s range.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                )}
              </div>
              {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                onClick={addDesiredValue}
                className="text-sm font-medium flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Anchor
              </Button>
              )}
            </div>

            {anchorError && (
              <p className="text-sm text-red-600 mb-2">{anchorError}</p>
            )}
            {desiredValues.length > 0 && (
              <div className="space-y-3">
                {desiredValues.map((desired, index) => (
                  <div key={index} className="grid grid-cols-2 gap-4 items-end">
                    <div>
                      {index === 0 && (
                        <label className="block text-xs text-gray-500 mb-1">
                          Value
                        </label>
                      )}
                      <Input
                        type="number"
                        placeholder="Value"
                        value={desired.value}
                        onChange={(e) => updateDesiredValue(index, 'value', e.target.value)}
                        readOnly={readOnly}
                        className={inputClass}
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        {index === 0 && (
                          <label className="block text-xs text-gray-500 mb-1">
                            Label
                          </label>
                        )}
                        <Input
                          placeholder="e.g., strongly agree"
                          value={desired.label}
                          onChange={(e) => updateDesiredValue(index, 'label', e.target.value)}
                          readOnly={readOnly}
                          className={inputClass}
                        />
                      </div>
                      {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDesiredValue(index)}
                        className="h-10 w-10 p-0 mt-auto"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Items - the questions a persona answers when this is used as a scale */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-gray-900">Items</label>
                {!readOnly && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">The questions the persona answers on this scale, each on the anchor points above.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                )}
              </div>
              {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                onClick={addItem}
                className="text-sm font-medium flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
              )}
            </div>

            {itemError && (
              <p className="text-sm text-red-600 mb-2">{itemError}</p>
            )}
            {items.length > 0 && (
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={item.id} className="flex gap-2 items-start">
                    <span className="mt-3 w-5 text-sm text-gray-500 flex-shrink-0">{index + 1}.</span>
                    <Input
                      placeholder="e.g., I believe in universal childcare"
                      value={item.text}
                      onChange={(e) => updateItem(index, e.target.value)}
                      readOnly={readOnly}
                      className={inputClass}
                    />
                    {!readOnly && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(index)}
                      className="h-10 w-10 p-0 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* How the measure may be used */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="measure-scale-only"
              checked={scaleOnly}
              onChange={(e) => { setScaleOnly(e.target.checked); touch(); }}
              disabled={readOnly}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed"
            />
            <label htmlFor="measure-scale-only" className="text-sm text-gray-700">
              <span className="font-semibold text-gray-900">Scale only</span>
              <span className="block text-gray-500">
                Placeholder: tick this if the measure can only be put to a persona as a scale.
                Leave it clear to also allow it as a rating on a step.
              </span>
            </label>
          </div>
        </form>
      </div>
    </Modal>

    {/* Unsaved changes confirmation */}
    {showUnsavedConfirm && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={() => setShowUnsavedConfirm(false)}>
        <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl border border-gray-200" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unsaved changes</h3>
          <p className="text-gray-600 text-sm mb-6">You have unsaved changes. Save or discard?</p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => { handleSubmit({ preventDefault: () => {} } as React.FormEvent); setShowUnsavedConfirm(false); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
              Save changes
            </Button>
            <Button onClick={handleClose} variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50">
              Discard changes
            </Button>
            <Button onClick={() => setShowUnsavedConfirm(false)} variant="ghost" className="w-full">
              Keep editing
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
