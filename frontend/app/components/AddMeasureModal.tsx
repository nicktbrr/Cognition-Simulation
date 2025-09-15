"use client";

import React, { useState } from "react";
import Modal from "./ui/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface AddMeasureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (measure: {
    title: string;
    description: string;
    metric: string;
    target: string;
  }) => void;
}

export default function AddMeasureModal({ isOpen, onClose, onAdd }: AddMeasureModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    metric: "",
    target: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.title.trim() || !formData.metric.trim()) {
      return;
    }

    onAdd(formData);
    
    // Reset form
    setFormData({
      title: "",
      description: "",
      metric: "",
      target: ""
    });
    
    onClose();
  };

  const handleCancel = () => {
    // Reset form on cancel
    setFormData({
      title: "",
      description: "",
      metric: "",
      target: ""
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Measure">
      <div className="space-y-4">
        <p className="text-gray-600 text-sm">
          Define a performance measure for your simulation project.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <Input
              placeholder="e.g., Customer Satisfaction"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <Textarea
              placeholder="Describe what this measure tracks..."
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              rows={3}
            />
          </div>

          {/* Metric and Target in a row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Metric
              </label>
              <Input
                placeholder="e.g., CSAT Score"
                value={formData.metric}
                onChange={(e) => setFormData({...formData, metric: e.target.value})}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target
              </label>
              <Input
                placeholder="e.g., ≥ 4.5/5.0"
                value={formData.target}
                onChange={(e) => setFormData({...formData, target: e.target.value})}
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Add Measure
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}