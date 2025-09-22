"use client";

import React, { useState, useEffect } from "react";
import { MoreHorizontal, Edit, Copy } from "lucide-react";

interface ProjectDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  onRename?: () => void;
  onReplicate?: () => void;
  onModify?: () => void;
  position?: 'top' | 'bottom';
}

export default function ProjectDropdown({ 
  isOpen, 
  onToggle, 
  onRename,
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
        <div className={`absolute left-0 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50 ${
          position === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
        }`}>
          <div className="py-1">
            <button 
              onClick={onRename}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Edit className="h-4 w-4" />
              Rename
            </button>
            <button 
              onClick={onReplicate}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Copy className="h-4 w-4" />
              Replicate
            </button>
            <button 
              onClick={onModify}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Edit className="h-4 w-4" />
              Modify
            </button>
          </div>
        </div>
      )}
    </div>
  );
}