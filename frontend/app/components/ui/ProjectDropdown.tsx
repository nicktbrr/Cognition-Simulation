"use client";

import React, { useState, useEffect } from "react";
import { MoreHorizontal } from "lucide-react";

interface ProjectDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  onReplicate?: () => void;
  onModify?: () => void;
  position?: 'top' | 'bottom';
}

export default function ProjectDropdown({ 
  isOpen, 
  onToggle, 
  onReplicate, 
  onModify,
  position = 'bottom' 
}: ProjectDropdownProps) {
  return (
    <div className="relative">
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="p-1 hover:bg-gray-100 rounded"
      >
        <MoreHorizontal className="w-4 h-4 text-gray-500" />
      </button>
      
      {isOpen && (
        <div className={`absolute left-0 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-50 ${
          position === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}>
          <div className="py-1">
            <button 
              onClick={onReplicate}
              className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Replicate
            </button>
            <button 
              onClick={onModify}
              className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Modify
            </button>
          </div>
        </div>
      )}
    </div>
  );
}