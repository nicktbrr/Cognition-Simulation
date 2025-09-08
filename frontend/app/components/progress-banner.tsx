/**
 * @file This file defines the ProgressBanner component, which displays a pinned
 * progress bar at the top of the page during simulation processing.
 */
"use client";

import { X } from "lucide-react";

// Progress data interface
interface ProgressData {
  id: string;
  user_id: string;
  task_id: string;
  progress: number;
  status: 'started' | 'processing' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// Props for the ProgressBanner component
interface ProgressBannerProps {
  progress: ProgressData | null;
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Renders a pinned progress banner at the top of the page.
 * Shows simulation progress with status and percentage.
 * @param {ProgressBannerProps} props - The props for the component.
 * @returns {JSX.Element} The rendered ProgressBanner component.
 */
export default function ProgressBanner({
  progress,
  isVisible,
  onClose,
}: ProgressBannerProps) {
  if (!isVisible || !progress) {
    return null;
  }

  const getStatusText = () => {
    switch (progress.status) {
      case 'started':
        return 'Starting simulation...';
      case 'processing':
        return 'Processing simulation...';
      case 'completed':
        return 'Simulation completed!';
      case 'failed':
        return 'Simulation failed';
      default:
        return 'Processing...';
    }
  };

  const getStatusColor = () => {
    switch (progress.status) {
      case 'started':
      case 'processing':
        return 'bg-amber-500';
      case 'completed':
        return 'bg-green-600';
      case 'failed':
        return 'bg-red-600';
      default:
        return 'bg-amber-500';
    }
  };

  return (
    <div className={`fixed top-0 left-0 w-full ${getStatusColor()} text-white z-50`}>
      <div className="container mx-auto py-1">
        <div className="flex items-center justify-center gap-2 mb-1">
          {progress.status === 'completed' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : progress.status === 'failed' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span>{getStatusText()} - {progress.progress}%</span>
          {progress.status === 'completed' || progress.status === 'failed' ? (
            <button
              onClick={onClose}
              className="ml-2 hover:bg-white/20 rounded p-1"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        {/* Progress bar */}
        <div className="w-full bg-white/20 rounded-full h-1">
          <div 
            className="bg-white h-1 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress.progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}
