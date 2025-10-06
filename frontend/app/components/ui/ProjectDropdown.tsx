"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Edit, Copy, Trash2 } from "lucide-react";

interface ProjectDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  onRename?: () => void;
  onReplicate?: () => void;
  onModify?: () => void;
  onDelete?: () => void;
  position?: 'top' | 'bottom';
}

export default function ProjectDropdown({ 
  isOpen, 
  onToggle, 
  onRename,
  onReplicate, 
  onModify,
  onDelete,
  position = 'bottom' 
}: ProjectDropdownProps) {
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('Toggle clicked, current isOpen:', isOpen);
    
    if (isOpen) {
      console.log('Closing dropdown');
      onToggle();
    } else {
      console.log('Opening dropdown');
      const button = e.currentTarget as HTMLButtonElement;
      const rect = button.getBoundingClientRect();
      
      if (position === 'top') {
        setDropdownPosition({
          top: rect.top + 30,
          right: window.innerWidth - rect.right
        });
      } else {
        setDropdownPosition({
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right + 50
        });
      }
      
      onToggle();
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      console.log('Click outside detected, isOpen:', isOpen);
      // Check if click is inside the dropdown or the toggle button
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        if (isOpen) {
          console.log('Closing dropdown from outside click');
          onToggle();
        }
      }
    };

    if (isOpen) {
      console.log('Adding click outside listener');
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onToggle]);

  return (
    <div className="relative">
      <button 
        ref={buttonRef}
        onClick={handleToggle}
        className="p-1 hover:bg-gray-100 rounded"
      >
        <MoreVertical className="w-4 h-4 text-gray-500" />
      </button>
      
      {/* Portal-based Dropdown */}
      {isOpen && createPortal(
        <div 
          ref={dropdownRef}
          className="fixed w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-[99999]"
          style={{
            top: dropdownPosition.top,
            right: dropdownPosition.right
          }}
        >
          <div className="py-1">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                console.log('Rename button clicked in dropdown');
                onRename?.();
              }}
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
            <button 
              onClick={(e) => {
                console.log('Delete button clicked!');
                e.preventDefault();
                e.stopPropagation();
                onDelete?.();
                onToggle(); // Close the dropdown
              }}
              onMouseDown={(e) => {
                console.log('Delete button mousedown!');
                e.stopPropagation();
              }}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}