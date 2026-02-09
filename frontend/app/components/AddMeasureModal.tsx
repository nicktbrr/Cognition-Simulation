"use client";

import React, { useState, useEffect } from "react";
import Modal from "./ui/Modal";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../components/ui/tooltip";
import { Plus, X, HelpCircle } from "lucide-react";

interface DesiredValue {
  value: string;
  label: string;
}

interface AddMeasureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (measure: {
    title: string;
    description: string;
    range: string;
    desiredValues: { value: number; label: string }[];
  }) => void;
  editingMeasure?: {
    id: string;
    title: string;
    description: string;
    range: string;
    desiredValues: { value: number; label: string }[];
  } | null;
  onUpdate?: (id: string, measure: {
    title: string;
    description: string;
    range: string;
    desiredValues: { value: number; label: string }[];
  }) => void;
  checkNameExists?: (title: string, excludeId?: string) => boolean;
}

export default function AddMeasureModal({ isOpen, onClose, onAdd, editingMeasure, onUpdate, checkNameExists }: AddMeasureModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    minValue: "",
    maxValue: ""
  });
  const [desiredValues, setDesiredValues] = useState<DesiredValue[]>([]);
  const [titleError, setTitleError] = useState<string>('');
  const [anchorLimitError, setAnchorLimitError] = useState<string>('');
  const [minMaxError, setMinMaxError] = useState<string>('');

  const wholeNumberOnlyRegex = /^-?\d*$/;
  const handleMinMaxChange = (
    field: 'minValue' | 'maxValue',
    raw: string
  ) => {
    if (wholeNumberOnlyRegex.test(raw)) {
      setFormData((prev) => ({ ...prev, [field]: raw }));
      setMinMaxError('');
      return;
    }
    const validPart = (raw.match(/^-?\d*/) || [''])[0];
    setFormData((prev) => ({ ...prev, [field]: validPart }));
    setMinMaxError('Only whole numbers are allowed (no decimals or other characters).');
  };

  // Populate form when editing measure changes
  useEffect(() => {
    if (editingMeasure) {
      const [min, max] = editingMeasure.range.split(' - ').map(val => val.trim());
      const minNum = parseFloat(min);
      const maxNum = parseFloat(max);
      setFormData({
        title: editingMeasure.title,
        description: editingMeasure.description,
        minValue: Number.isNaN(minNum) ? min : String(Math.round(minNum)),
        maxValue: Number.isNaN(maxNum) ? max : String(Math.round(maxNum))
      });
      setDesiredValues(
        editingMeasure.desiredValues.map(dv => ({
          value: dv.value.toString(),
          label: dv.label
        }))
      );
    } else {
      // Reset form when not editing
      setFormData({
        title: "",
        description: "",
        minValue: "",
        maxValue: ""
      });
      setDesiredValues([]);
    }
    setTitleError(''); // Reset error when modal opens/changes
    setAnchorLimitError('');
    setMinMaxError('');
  }, [editingMeasure, isOpen]);

  // Handle title change with validation
  const handleTitleChange = (title: string) => {
    setFormData(prev => ({ ...prev, title }));
    
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

  // Max anchor points = number of discrete values between min and max (inclusive)
  const minNum = formData.minValue !== "" ? parseFloat(formData.minValue) : NaN;
  const maxNum = formData.maxValue !== "" ? parseFloat(formData.maxValue) : NaN;
  const maxAnchorPoints =
    !Number.isNaN(minNum) && !Number.isNaN(maxNum) && maxNum >= minNum
      ? Math.max(0, Math.floor(maxNum) - Math.ceil(minNum) + 1)
      : null;

  const addDesiredValue = () => {
    const limit = maxAnchorPoints ?? Infinity;
    if (desiredValues.length >= limit) return;
    setDesiredValues([...desiredValues, { value: "", label: "" }]);
  };

  const removeDesiredValue = (index: number) => {
    setDesiredValues(desiredValues.filter((_, i) => i !== index));
  };

  const updateDesiredValue = (index: number, field: 'value' | 'label', value: string) => {
    const updated = desiredValues.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    );
    setDesiredValues(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAnchorLimitError('');

    // Basic validation
    if (!formData.title.trim() || !formData.description.trim() || !formData.minValue || !formData.maxValue) {
      return;
    }

    // Convert desired values to proper format
    const processedDesiredValues = desiredValues
      .filter(dv => dv.value.trim() && dv.label.trim())
      .map(dv => ({ value: parseFloat(dv.value), label: dv.label }));

    const minNum = parseFloat(formData.minValue);
    const maxNum = parseFloat(formData.maxValue);
    const submitMaxAnchors =
      !Number.isNaN(minNum) && !Number.isNaN(maxNum) && maxNum >= minNum
        ? Math.max(0, Math.floor(maxNum) - Math.ceil(minNum) + 1)
        : null;
    if (
      submitMaxAnchors != null &&
      processedDesiredValues.length > submitMaxAnchors
    ) {
      setAnchorLimitError(
        `Anchor points cannot exceed ${submitMaxAnchors} (one per discrete value from ${Math.ceil(minNum)} to ${Math.floor(maxNum)}).`
      );
      return;
    }

    const minInt = Math.round(parseFloat(formData.minValue));
    const maxInt = Math.round(parseFloat(formData.maxValue));
    const measureData = {
      title: formData.title,
      description: formData.description,
      range: `${minInt} - ${maxInt}`,
      desiredValues: processedDesiredValues
    };

    if (editingMeasure && onUpdate) {
      onUpdate(editingMeasure.id, measureData);
    } else {
      onAdd(measureData);
    }
    
    // Reset form
    setFormData({
      title: "",
      description: "",
      minValue: "",
      maxValue: ""
    });
    setDesiredValues([]);
    
    onClose();
  };

  const handleCancel = () => {
    // Reset form on cancel
    setFormData({
      title: "",
      description: "",
      minValue: "",
      maxValue: ""
    });
    setDesiredValues([]);
    setTitleError('');
    setAnchorLimitError('');
    setMinMaxError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editingMeasure ? "Edit Measure" : "Add New Measure"}>
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
              className={`w-full border-2 rounded-lg px-4 py-3 focus:ring-2 focus:ring-opacity-20 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opacity-20 focus-visible:ring-offset-0 ${
                titleError
                  ? 'border-red-500 focus:border-red-500 focus:ring-red-500 focus-visible:ring-red-500'
                  : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500 focus-visible:ring-blue-500'
              }`}
            />
            {titleError && (
              <p className="mt-1 text-sm text-red-600">{titleError}</p>
            )}
          </div>

          {/* Definition */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              Definition
            </label>
            <Textarea
              placeholder="Describe what this measure tracks (max 200 characters)..."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              maxLength={200}
              rows={4}
              required
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 resize-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-opacity-20 focus-visible:ring-offset-0"
            />
          </div>

          {/* Min and Max Values in a row */}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Min Value
              </label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g., 0"
                value={formData.minValue}
                onChange={(e) => handleMinMaxChange('minValue', e.target.value)}
                required
                className={`w-full border-2 rounded-lg px-4 py-3 focus:ring-2 focus:ring-opacity-20 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opacity-20 focus-visible:ring-offset-0 ${
                  minMaxError
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500 focus-visible:ring-red-500'
                    : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500 focus-visible:ring-blue-500'
                }`}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Max Value
              </label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="e.g., 10"
                value={formData.maxValue}
                onChange={(e) => handleMinMaxChange('maxValue', e.target.value)}
                required
                className={`w-full border-2 rounded-lg px-4 py-3 focus:ring-2 focus:ring-opacity-20 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-opacity-20 focus-visible:ring-offset-0 ${
                  minMaxError
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500 focus-visible:ring-red-500'
                    : 'border-gray-200 focus:border-blue-500 focus:ring-blue-500 focus-visible:ring-blue-500'
                }`}
              />
            </div>
          </div>
          {minMaxError && (
            <p className="text-sm text-red-600 -mt-4">{minMaxError}</p>
          )}

          {/* Anchor Points */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-gray-900">
                  Anchor Points
                  {maxAnchorPoints != null && (
                    <span className="text-gray-500 font-normal ml-1">
                      (max {maxAnchorPoints})
                    </span>
                  )}
                </label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Labels for a specific value on a rating scale. Limited to one per discrete value between min and max.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={addDesiredValue}
                disabled={maxAnchorPoints != null && desiredValues.length >= maxAnchorPoints}
                className="text-sm font-medium flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Anchor
              </Button>
            </div>
            
            {anchorLimitError && (
              <p className="text-sm text-red-600 mb-2">{anchorLimitError}</p>
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
                        className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-opacity-20 focus-visible:ring-offset-0"
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
                          placeholder="Label"
                          value={desired.label}
                          onChange={(e) => updateDesiredValue(index, 'label', e.target.value)}
                          className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-opacity-20 focus-visible:ring-offset-0"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDesiredValue(index)}
                        className="h-10 w-10 p-0 mt-auto"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="px-6 py-2"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
              disabled={!!titleError || !!minMaxError}
            >
              {editingMeasure ? "Update Measure" : "Add Measure"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}