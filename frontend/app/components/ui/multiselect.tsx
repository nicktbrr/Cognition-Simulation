"use client"

import React, { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { Button } from './button'

interface MultiselectOption {
  id: string
  title: string
  description: string
}

interface MultiselectProps {
  options: MultiselectOption[]
  selectedValues: string[]
  onSelectionChange: (selectedIds: string[]) => void
  placeholder?: string
  loading?: boolean
  className?: string
}

export default function Multiselect({
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select options...",
  loading = false,
  className = ""
}: MultiselectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleToggleOption = (optionId: string) => {
    const newSelection = selectedValues.includes(optionId)
      ? selectedValues.filter(id => id !== optionId)
      : [...selectedValues, optionId]
    
    onSelectionChange(newSelection)
  }

  const handleRemoveOption = (optionId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    const newSelection = selectedValues.filter(id => id !== optionId)
    onSelectionChange(newSelection)
  }

  const getSelectedOptions = () => {
    return options.filter(option => selectedValues.includes(option.id))
  }

  const selectedOptions = getSelectedOptions()

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between text-left h-auto min-h-[40px] p-2"
        disabled={loading}
      >
        <div className="flex flex-wrap gap-1 flex-1">
          {selectedOptions.length === 0 ? (
            <span className="text-muted-foreground">
              {loading ? "Loading..." : placeholder}
            </span>
          ) : (
            selectedOptions.map(option => (
              <span
                key={option.id}
                className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-md"
              >
                {option.title}
                <button
                  onClick={(e) => handleRemoveOption(option.id, e)}
                  className="hover:bg-blue-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="p-3 text-sm text-gray-500 text-center">
              {loading ? "Loading options..." : "No options available"}
            </div>
          ) : (
            <div className="py-1">
              {options.map(option => {
                const isSelected = selectedValues.includes(option.id)
                return (
                  <div
                    key={option.id}
                    onClick={() => handleToggleOption(option.id)}
                    className="flex items-start gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {isSelected ? (
                        <Check className="w-4 h-4 text-blue-600" />
                      ) : (
                        <div className="w-4 h-4 border border-gray-300 rounded" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">
                        {option.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {option.description}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
