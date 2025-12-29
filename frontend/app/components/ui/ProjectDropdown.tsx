"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { MoreVertical, Edit, Copy, Trash2, Folder } from "lucide-react";

interface Folder {
  folder_id: string;
  folder_name: string;
  created_at: string;
  project_count?: number;
}

interface ProjectDropdownProps {
  isOpen: boolean;
  onToggle: () => void;
  onRename?: () => void;
  onReplicate?: () => void;
  onModify?: () => void;
  onDelete?: () => void;
  onMoveToFolder?: () => void;
  folders?: Folder[];
  position?: 'top' | 'bottom';
}

export default function ProjectDropdown({ 
  isOpen, 
  onToggle, 
  onRename,
  onReplicate, 
  onModify,
  onDelete,
  onMoveToFolder,
  folders = [],
  position = 'bottom' 
}: ProjectDropdownProps) {
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, right: 0, maxHeight: 200 });
  const [showFolderSubmenu, setShowFolderSubmenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const calculatePosition = useCallback((rect: DOMRect) => {
    // Estimate dropdown height (approximately 200px for all menu items)
    const estimatedDropdownHeight = 200;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    // Determine if we should show above or below based on available space
    // Use 'top' position if there's not enough space below but enough above
    const shouldShowAbove = spaceBelow < estimatedDropdownHeight && spaceAbove > spaceBelow;
    const actualPosition = position === 'top' || shouldShowAbove ? 'top' : 'bottom';
    
    // Calculate horizontal position (ensure it doesn't go off the right edge)
    const dropdownWidth = 192; // w-48 = 12rem = 192px
    const rightSpace = window.innerWidth - rect.right;
    const leftSpace = rect.left;
    
    // If dropdown would go off the right edge, adjust
    let rightPosition = window.innerWidth - rect.right;
    if (rightSpace < dropdownWidth && leftSpace > rightSpace) {
      // Position from left instead of right
      rightPosition = window.innerWidth - rect.left - dropdownWidth;
    }
    // Ensure it doesn't go off the left edge either
    rightPosition = Math.max(8, Math.min(rightPosition, window.innerWidth - dropdownWidth - 8));
    
    let topPosition: number;
    let maxHeight: number;
    
    if (actualPosition === 'top') {
      topPosition = rect.top - estimatedDropdownHeight - 4;
      // Ensure it doesn't go above viewport
      const constrainedTop = Math.max(8, topPosition);
      topPosition = constrainedTop;
      // Calculate max height based on available space from top to button
      maxHeight = Math.min(estimatedDropdownHeight, rect.top - constrainedTop - 4);
    } else {
      topPosition = rect.bottom + 4;
      // Ensure it doesn't go below viewport
      const constrainedTop = Math.min(topPosition, window.innerHeight - 8);
      topPosition = constrainedTop;
      // Calculate max height based on available space below
      maxHeight = Math.min(estimatedDropdownHeight, window.innerHeight - constrainedTop - 8);
    }
    
    return {
      top: topPosition,
      right: rightPosition,
      maxHeight: Math.max(100, maxHeight) // Ensure minimum height for usability
    };
  }, [position]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (isOpen) {
      onToggle();
    } else {
      const button = e.currentTarget as HTMLButtonElement;
      const rect = button.getBoundingClientRect();
      const calculatedPosition = calculatePosition(rect);
      setDropdownPosition(calculatedPosition);
      onToggle();
    }
  };

  // Recalculate position when dropdown is open and window is resized or scrolled
  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;

    const updatePosition = () => {
      if (!buttonRef.current) return;
      
      const rect = buttonRef.current.getBoundingClientRect();
      const calculatedPosition = calculatePosition(rect);
      setDropdownPosition(calculatedPosition);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, calculatePosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if click is inside the dropdown or the toggle button
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        if (isOpen) {
          onToggle();
        }
      }
    };

    if (isOpen) {
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
          className="fixed w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-[99999] overflow-y-auto"
          style={{
            top: `${dropdownPosition.top}px`,
            right: `${dropdownPosition.right}px`,
            maxHeight: `${dropdownPosition.maxHeight}px`
          }}
        >
          <div className="py-1">
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRename?.();
                onToggle(); // Close the dropdown
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Edit className="h-4 w-4" />
              Rename
            </button>
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onReplicate?.();
                onToggle(); // Close the dropdown
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors border-b border-gray-100"
            >
              <Copy className="h-4 w-4" />
              Replicate
            </button>
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onModify?.();
                onToggle(); // Close the dropdown
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Edit className="h-4 w-4" />
              Modify
            </button>
            <div className="relative">
              <button 
                onMouseEnter={() => setShowFolderSubmenu(true)}
                onMouseLeave={() => setShowFolderSubmenu(false)}
                className="flex items-center justify-between w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Folder className="h-4 w-4" />
                  Move to folder
                </div>
                <span className="text-xs text-gray-400">›</span>
              </button>
              {showFolderSubmenu && (
                <div 
                  className="absolute left-full top-0 ml-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-[99999]"
                  onMouseEnter={() => setShowFolderSubmenu(true)}
                  onMouseLeave={() => setShowFolderSubmenu(false)}
                >
                  <div className="py-1">
                    {folders.map((folder) => (
                      <button
                        key={folder.folder_id}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onMoveToFolder?.();
                          onToggle();
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                        }}
                        className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Folder className="h-4 w-4" />
                        {folder.folder_name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDelete?.();
                onToggle(); // Close the dropdown
              }}
              onMouseDown={(e) => {
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