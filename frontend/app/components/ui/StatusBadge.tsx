import React from "react";

interface StatusBadgeProps {
  status: string;
  progress?: number; // Optional progress percentage (0-100)
}

export default function StatusBadge({ status, progress }: StatusBadgeProps) {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Completed':
        return 'bg-blue-100 text-blue-800';
      case 'Running':
        return 'bg-gray-200 text-gray-800'; // Light gray as shown in image
      case 'Draft':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // If status is Running and progress is provided (and less than 100), show badge + percentage
  if (status === 'Running' && progress !== undefined && progress < 100) {
    return (
      <div className="flex items-center gap-2">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusStyle(status)}`}>
          Running
        </span>
        <span className="text-sm font-medium text-blue-600">
          {Math.round(progress)}%
        </span>
      </div>
    );
  }
  
  // If progress is 100% or greater, but status is still Running, still show the percentage
  if (status === 'Running' && progress !== undefined && progress >= 100) {
    return (
      <div className="flex items-center gap-2">
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusStyle(status)}`}>
          Running
        </span>
        <span className="text-sm font-medium text-blue-600">
          100%
        </span>
      </div>
    );
  }

  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusStyle(status)}`}>
      {status}
    </span>
  );
}