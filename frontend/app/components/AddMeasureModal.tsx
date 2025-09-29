"use client";

import React, { useState } from "react";
import Modal from "./ui/Modal";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Plus, X } from "lucide-react";

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
}

export default function AddMeasureModal({ isOpen, onClose, onAdd }: AddMeasureModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    minValue: "",
    maxValue: ""
  });
  const [desiredValues, setDesiredValues] = useState<DesiredValue[]>([]);

  const addDesiredValue = () => {
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
    
    // Basic validation
    if (!formData.title.trim() || !formData.description.trim() || !formData.minValue || !formData.maxValue) {
      return;
    }

    // Convert desired values to proper format
    const processedDesiredValues = desiredValues
      .filter(dv => dv.value.trim() && dv.label.trim())
      .map(dv => ({ value: parseFloat(dv.value), label: dv.label }));

    onAdd({
      title: formData.title,
      description: formData.description,
      range: `${formData.minValue} - ${formData.maxValue}`,
      desiredValues: processedDesiredValues
    });
    
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
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Measure">
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
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-opacity-20 focus-visible:ring-offset-0"
            />
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
                type="number"
                placeholder="e.g., 0"
                value={formData.minValue}
                onChange={(e) => setFormData({...formData, minValue: e.target.value})}
                required
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-opacity-20 focus-visible:ring-offset-0"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Max Value
              </label>
              <Input
                type="number"
                placeholder="e.g., 100"
                value={formData.maxValue}
                onChange={(e) => setFormData({...formData, maxValue: e.target.value})}
                required
                className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-20 focus:outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-opacity-20 focus-visible:ring-offset-0"
              />
            </div>
          </div>

          {/* Desired Values */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="text-sm font-semibold text-gray-900">
                Desired Values
              </label>
              <Button
                type="button"
                variant="ghost"
                onClick={addDesiredValue}
                className="text-sm font-medium flex items-center gap-1"
              >
                <Plus className="h-4 w-4" />
                Add Value
              </Button>
            </div>
            
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
            >
              Add Measure
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}