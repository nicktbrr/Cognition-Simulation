import React from "react";
import { Edit, Trash2 } from "lucide-react";

interface MeasureCardProps {
  title: string;
  description: string;
  metric: string;
  target: string;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function MeasureCard({ 
  title, 
  description, 
  metric, 
  target, 
  onEdit, 
  onDelete 
}: MeasureCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      {/* Header with actions */}
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-semibold text-blue-600">{title}</h3>
        <div className="flex items-center space-x-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600 transition-colors"
            >
              <Edit className="w-4 h-4" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-gray-600 text-sm mb-4">{description}</p>

      {/* Metric and Target */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">Metric</span>
          <span className="text-sm font-medium text-gray-700">Target</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-lg font-semibold text-blue-600">{metric}</span>
          <span className="text-lg font-semibold text-blue-600">{target}</span>
        </div>
      </div>
    </div>
  );
}